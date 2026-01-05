// Main Collaboration Lifecycle
import { state } from '../state.js';
import { showAlert } from '../popupModal.js';
import { registerSession, unregisterSession, markSessionAvailable } from '../discovery.js';
import { redrawCanvas } from '../canvas.js';
import { updateConnectionStatus } from './connectionStatus.js';
import { removeCodeFromURL } from './urlUtils.js';
import { setupDataConnection, attemptConnection, clearOngoingConnections } from './dataConnection.js';
import { setupCallHandlers } from './videoCall.js';

export async function startCollaboration() {

    try {
        // Generate share code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let shareCode = '';
        for (let i = 0; i < 5; i++) {
            shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        state.peer = new Peer(shareCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
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
                console.warn('Failed to register session with discovery service:', err);
                // Continue anyway - discovery is optional
            });
            
            // If screen sharing is already active, share it with peers when they connect
            // This will be handled when connections are established in setupDataConnection
        });

        state.peer.on('connection', (dataConnection) => {
            const peerId = dataConnection.peer;
            
            console.log(`Host received connection from peer ${peerId}, open: ${dataConnection.open}, readyState: ${dataConnection.readyState}`);
            
            // Check if we already have a connection from this peer
            const existingConnection = state.dataConnections.get(peerId);
            if (existingConnection) {
                // If existing connection is open, close the new duplicate
                if (existingConnection.open || existingConnection.readyState === 'open') {
                    console.log(`Connection from peer ${peerId} already exists and is open, closing duplicate`);
                    dataConnection.close();
                    return;
                } else {
                    // Existing connection is not open, replace it with the new one
                    console.log(`Replacing stale connection from peer ${peerId}`);
                    existingConnection.close();
                    // Remove the stale connection from maps
                    state.dataConnections.delete(peerId);
                    state.connectedPeers.delete(peerId);
                }
            }
            
            // Don't store the connection yet - wait for it to open
            // This prevents premature duplicate detection
            // setupDataConnection will store it when it opens
            console.log(`Host setting up data connection for peer ${peerId}`);
            setupDataConnection(dataConnection, peerId);
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if we already have a call from this peer
            if (state.calls.has(peerId)) {
                console.log(`Call from peer ${peerId} already exists, closing duplicate`);
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

        state.peer = new Peer({
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
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
            console.log(`Peer received incoming call from host ${peerId}`, incomingCall);
            
            // Check if we already have a call from this peer
            if (state.calls.has(peerId)) {
                console.log(`Call from host ${peerId} already exists, closing duplicate`);
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
                console.log(`Peer answered call from host ${peerId} with stream:`, streamToAnswer);
            } else {
                console.error('Peer: No stream available to answer call');
                // Still answer even without stream
                try {
                    incomingCall.answer();
                } catch (e) {
                    console.error('Error answering call without stream:', e);
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
            console.warn('Failed to mark session as available:', err);
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
    
    // Close all calls
    state.calls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.calls.clear();
    
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
    redrawCanvas();
}

