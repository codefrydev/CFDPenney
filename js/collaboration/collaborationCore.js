// Main Collaboration Lifecycle
import { state } from '../state.js';
import { showAlert } from '../popupModal.js';
import { registerSession, unregisterSession, markSessionAvailable } from '../discovery.js';
import { redrawCanvas } from '../canvas.js';
import { updateConnectionStatus } from './connectionStatus.js';
import { removeCodeFromURL } from './urlUtils.js';
import { setupDataConnection, attemptConnection, clearOngoingConnections } from './dataConnection.js';
import { setupCallHandlers } from './videoCall.js';
import { updateParticipantsPanel } from './participantsPanel.js';

export async function startCollaboration() {

    try {
        // Generate share code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let shareCode = '';
        for (let i = 0; i < 5; i++) {
            shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Log environment info for debugging

        state.peer = new Peer(shareCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { 
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    { 
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ],
                iceCandidatePoolSize: 10
            }
        });
        
        // Log PeerJS connection events
        state.peer.on('open', (id) => {
        });
        
        state.peer.on('error', (err) => {
            console.error('[PeerJS] Peer error:', err);
        });

        state.isHosting = true;
        state.shareCode = shareCode;
        updateConnectionStatus(false, shareCode);

        state.peer.on('open', (id) => {
            // Store our peer ID
            state.myPeerId = id;
            // Don't set isCollaborating here - wait for data connection to open
            // This ensures we only mark as collaborating when actually connected
            
            // Register session with discovery service
            registerSession(shareCode, null, state.mode).catch(err => {
                // Failed to register session with discovery service - continue anyway
            });
            
            // If screen sharing is already active, share it with peers when they connect
            // This will be handled when connections are established in setupDataConnection
        });

        // Track connection attempts per peer to prevent replacement loops
        const connectionAttempts = new Map(); // peerId -> { count, firstAttempt, lastAttempt }
        const CONNECTION_GRACE_PERIOD = 8000; // 8 seconds grace period before considering stale
        const MAX_REPLACEMENTS = 3; // Max replacements per peer before blocking
        
        state.peer.on('connection', (dataConnection) => {
            const peerId = dataConnection.peer;
            const now = Date.now();
            
            // Check if we already have a connection from this peer
            const existingConnection = state.dataConnections.get(peerId);
            if (existingConnection) {
                // If existing connection is open, close the new duplicate
                if (existingConnection.open || existingConnection.readyState === 'open') {
                    dataConnection.close();
                    return;
                } else {
                    // Check if ICE is actively negotiating - don't replace if it is
                    const pc = existingConnection.peerConnection;
                    const iceState = pc?.iceConnectionState;
                    const isIceActive = iceState === 'checking' || iceState === 'connected' || iceState === 'completed';
                    
                    // Existing connection is not open - check if it's truly stale
                    const existingPeerInfo = state.connectedPeers.get(peerId);
                    const existingAge = existingPeerInfo ? (now - existingPeerInfo.connectedAt) : 0;
                    
                    // Don't replace if ICE is actively negotiating (unless it's been a very long time)
                    if (isIceActive && existingAge < 20000) {
                        dataConnection.close();
                        return;
                    }
                    
                    // Get replacement attempt info
                    const attemptInfo = connectionAttempts.get(peerId) || { count: 0, firstAttempt: now, lastAttempt: now };
                    
                    // Only replace if:
                    // 1. Existing connection is older than grace period, OR
                    // 2. We haven't exceeded max replacements
                    if (existingAge < CONNECTION_GRACE_PERIOD && attemptInfo.count >= MAX_REPLACEMENTS) {
                        dataConnection.close();
                        return;
                    }
                    
                    // Track this replacement attempt
                    attemptInfo.count += 1;
                    attemptInfo.lastAttempt = now;
                    if (attemptInfo.count === 1) {
                        attemptInfo.firstAttempt = now;
                    }
                    connectionAttempts.set(peerId, attemptInfo);
                    
                    existingConnection.close();
                    // Remove the stale connection from maps
                    state.dataConnections.delete(peerId);
                    state.connectedPeers.delete(peerId);
                }
            } else {
                // New connection attempt - reset counter if enough time has passed
                const attemptInfo = connectionAttempts.get(peerId);
                if (attemptInfo && (now - attemptInfo.firstAttempt) > 30000) {
                    // Reset after 30 seconds
                    connectionAttempts.delete(peerId);
                }
            }
            
            // Don't store the connection yet - wait for it to open
            // This prevents premature duplicate detection
            // setupDataConnection will store it when it opens
            setupDataConnection(dataConnection, peerId);
            
            // Clean up attempt tracking when connection opens
            dataConnection.on('open', () => {
                connectionAttempts.delete(peerId);
            });
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if this is a camera call (using metadata)
            const isCameraCall = incomingCall.metadata && incomingCall.metadata.isCameraCall;
            
            if (isCameraCall) {
                // Handle camera call separately
                
                // Check if we already have a camera call from this peer
                if (state.cameraCalls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Answer with our camera stream if available, otherwise dummy stream
                let streamToShare = null;
                if (state.isCameraActive && state.cameraStream) {
                    streamToShare = state.cameraStream;
                    // Log audio track state when answering call
                    const audioTracks = streamToShare.getAudioTracks();
                    if (audioTracks.length > 0) {
                        // Audio tracks available
                    } else {
                        // No audio tracks in camera stream
                    }
                } else {
                    // Create dummy stream for camera calls when camera is off
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToShare = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToShare) {
                    incomingCall.answer(streamToShare);
                    state.cameraCalls.set(peerId, incomingCall);
                    // Mark as camera call for handler
                    incomingCall._isCameraCall = true;
                    setupCallHandlers(incomingCall, peerId);
                    
                    // If camera is active, ensure tracks are synchronized after connection is established
                    // This handles cases where audio track state might need to be updated
                    if (state.isCameraActive && state.cameraStream && window.shareCameraWithPeers) {
                        setTimeout(() => {
                            if (state.cameraCalls.has(peerId) && state.isCameraActive && state.cameraStream) {
                                window.shareCameraWithPeers(state.cameraStream);
                            }
                        }, 500);
                    }
                } else {
                    incomingCall.close();
                }
            } else {
                // Handle screen share call
                // Check if we already have a call from this peer
                if (state.calls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Answer with current screen share if available, otherwise dummy stream
                let streamToShare = null;
                if (state.mode === 'screen' && state.stream) {
                    streamToShare = state.stream;
                } else {
                    // Create dummy stream for non-screen modes
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToShare = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToShare) {
                    incomingCall.answer(streamToShare);
                    state.calls.set(peerId, incomingCall);
                    setupCallHandlers(incomingCall, peerId);
                } else {
                    incomingCall.close();
                }
            }
        });

        state.peer.on('error', (err) => {
            console.error('Peer error (host):', err);
            
            // Handle specific errors
            if (err.type === 'peer-unavailable') {
                // This is expected if someone tries to connect before we're ready
            } else if (err.type === 'network') {
                showAlert('Network error. Please check your internet connection.');
            }
        });

    } catch (err) {
        console.error('Error starting collaboration:', err);
        showAlert('Failed to start collaboration: ' + err.message);
    }
}

export async function joinCollaborationWithCode(code) {
    if (!code || code.length !== 5) {
        showAlert('Invalid share code. Please enter a 5-character code.');
        return;
    }

    // Show connecting status
    updateConnectionStatus(false, null);
    const statusText = document.getElementById('connection-text');
    if (statusText) {
        statusText.textContent = 'Connecting...';
    }

    try {
        // Clean up any existing peer
        if (state.peer) {
            state.peer.destroy();
            state.peer = null;
        }

        // Log environment info for debugging

        state.peer = new Peer({
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { 
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    { 
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ],
                iceCandidatePoolSize: 10
            }
        });
        
        // Log PeerJS connection events
        state.peer.on('open', (id) => {
            // Peer opened
        });
        
        state.peer.on('error', (err) => {
            console.error('[PeerJS] Peer error:', err);
        });

        let connectionAttempted = false;

        state.peer.on('open', (id) => {
            // Store our peer ID
            state.myPeerId = id;
            // Wait a bit to ensure peer is fully ready
            setTimeout(() => {
                if (connectionAttempted) return;
                connectionAttempted = true;
                
                // Connect data channel with retry logic
                attemptConnection(code, 0, () => {
                    stopCollaboration();
                });
            }, 500);
        });

        // Listen for incoming calls from the host
        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if this is a camera call (using metadata)
            const isCameraCall = incomingCall.metadata && incomingCall.metadata.isCameraCall;
            
            if (isCameraCall) {
                // Handle camera call separately
                
                // Check if we already have a camera call from this peer
                if (state.cameraCalls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Set up handlers FIRST before answering
                state.cameraCalls.set(peerId, incomingCall);
                // Mark as camera call for handler
                incomingCall._isCameraCall = true;
                setupCallHandlers(incomingCall, peerId);
                
                // Answer with our camera stream if available, otherwise dummy stream
                let streamToAnswer = null;
                if (state.isCameraActive && state.cameraStream) {
                    streamToAnswer = state.cameraStream;
                    // Log audio track state when answering call
                    const audioTracks = streamToAnswer.getAudioTracks();
                    if (audioTracks.length > 0) {
                        // Audio tracks available
                    } else {
                        // No audio tracks in camera stream
                    }
                } else {
                    // Create dummy stream for camera calls when camera is off
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToAnswer) {
                    incomingCall.answer(streamToAnswer);
                    
                    // If camera is active, ensure tracks are synchronized after connection is established
                    // This handles cases where audio track state might need to be updated
                    if (state.isCameraActive && state.cameraStream && window.shareCameraWithPeers) {
                        setTimeout(() => {
                            if (state.cameraCalls.has(peerId) && state.isCameraActive && state.cameraStream) {
                                window.shareCameraWithPeers(state.cameraStream);
                            }
                        }, 500);
                    }
                } else {
                    console.error('Joiner: No camera stream available to answer call');
                    // Still answer even without stream
                    try {
                        incomingCall.answer();
                    } catch (e) {
                        console.error('Error answering camera call:', e);
                    }
                }
            } else {
                // Handle screen share call
                // Check if we already have a call from this peer
                if (state.calls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Set up handlers FIRST before answering, so we can receive the stream
                state.calls.set(peerId, incomingCall);
                setupCallHandlers(incomingCall, peerId);
                
                // Answer the call - we'll receive the host's stream via the 'stream' event
                // Create a dummy stream to send (or our own screen if sharing)
                let streamToAnswer = null;
                if (state.mode === 'screen' && state.stream) {
                    streamToAnswer = state.stream;
                } else {
                    // Create dummy stream for non-screen modes
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToAnswer) {
                    incomingCall.answer(streamToAnswer);
                } else {
                    console.error('Peer: No stream available to answer call');
                    // Still answer even without stream
                    try {
                        incomingCall.answer();
                    } catch (e) {
                        console.error('Error answering call without stream:', e);
                    }
                }
            }
        });

        state.peer.on('error', (err) => {
            console.error('Peer error:', err);
            
            // Handle specific error types
            if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
                if (statusText) {
                    statusText.textContent = 'Host not found';
                }
                setTimeout(() => {
                    showAlert('Could not connect to host. Please check:\n\n1. The share code is correct\n2. The host is still online\n3. Try again in a moment');
                    // stopCollaboration will be called via attemptConnection's callback
                }, 1000);
            } else if (err.type === 'network') {
                if (statusText) {
                    statusText.textContent = 'Network error';
                }
                showAlert('Network error. Please check your internet connection and try again.');
                stopCollaboration();
            } else {
                if (statusText) {
                    statusText.textContent = 'Connection failed';
                }
                showAlert('Connection error: ' + (err.message || err.type || 'Unknown error'));
                stopCollaboration();
            }
        });

    } catch (err) {
        console.error('Error joining collaboration:', err);
        showAlert('Failed to join: ' + err.message);
        stopCollaboration();
    }
}

export function stopCollaboration() {
    // Clear any ongoing connection attempts
    clearOngoingConnections();
    
    // Mark session as available before unregistering (if it was connected)
    if (state.shareCode && state.isHosting) {
        markSessionAvailable(state.shareCode).catch(err => {
            // Failed to mark session as available
        });
    }
    
    // Unregister from discovery service
    if (state.shareCode && state.isHosting) {
        unregisterSession(state.shareCode);
    }
    
    // Close all data connections
    state.dataConnections.forEach((conn, peerId) => {
        if (conn) {
            conn.close();
        }
    });
    state.dataConnections.clear();
    
    // Close all calls (screen share)
    state.calls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.calls.clear();
    
    // Close all camera calls
    state.cameraCalls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.cameraCalls.clear();
    
    // Clear peer tracking
    state.connectedPeers.clear();
    
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    state.isCollaborating = false;
    state.isHosting = false;
    state.shareCode = null;
    state.peerElements = [];
    state.myPeerId = null;
    removeCodeFromURL();
    updateConnectionStatus(false);
    
    // Update participants panel
    if (window.updateParticipantsPanel) {
        window.updateParticipantsPanel();
    }
    
    redrawCanvas();
}

