// Main Collaboration Lifecycle
// Shared module for managing peer connections and collaboration sessions

import { PEER_CONFIG } from '../config/iceServers.js';
import { SHARE_CODE_CHARS, SHARE_CODE_LENGTH, CONNECTION_GRACE_PERIOD, MAX_REPLACEMENTS } from '../config/constants.js';
import { setupDataConnection, attemptConnection, clearOngoingConnections } from './dataConnection.js';

/**
 * Initialize PeerJS (for desktop app that loads from CDN)
 * @returns {Object|null} Peer constructor or null
 */
export function initPeerJS() {
    if (typeof window !== 'undefined' && typeof window.Peer !== 'undefined') {
        return window.Peer;
    } else if (typeof Peer !== 'undefined') {
        return Peer;
    }
    console.error('PeerJS not loaded. Please include PeerJS library.');
    return null;
}

/**
 * Start hosting a collaboration session
 * @param {Object} state - The application state
 * @param {Object} adapter - The platform adapter
 * @param {Function} handlePeerMessage - Message handler function
 * @param {Function} setupCallHandlers - Call handler setup function
 * @param {Object} Peer - PeerJS constructor (optional, will try to get from window)
 */
export async function startCollaboration(state, adapter, handlePeerMessage, setupCallHandlers, Peer = null) {
    // Get Peer constructor
    if (!Peer) {
        Peer = initPeerJS();
    }
    
    if (!Peer) {
        adapter.showAlert('PeerJS library not loaded. Please refresh the page.');
        return;
    }

    try {
        // Generate share code
        let shareCode = '';
        for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
            shareCode += SHARE_CODE_CHARS.charAt(Math.floor(Math.random() * SHARE_CODE_CHARS.length));
        }

        state.peer = new Peer(shareCode, PEER_CONFIG);

        state.isHosting = true;
        state.shareCode = shareCode;

        state.peer.on('open', (id) => {
            state.myPeerId = id;
            adapter.updateConnectionStatus(false, shareCode);
            
            // Register session with discovery service (web only)
            adapter.registerSession(shareCode, null, state.mode);
            
            // Initialize chat and participants panel
            adapter.initChat();
            adapter.updateParticipantsPanel();
        });

        // Track connection attempts per peer to prevent replacement loops
        const connectionAttempts = new Map();
        
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
                    // Check if ICE is actively negotiating
                    const pc = existingConnection.peerConnection;
                    const iceState = pc?.iceConnectionState;
                    const isIceActive = iceState === 'checking' || iceState === 'connected' || iceState === 'completed';
                    
                    const existingPeerInfo = state.connectedPeers.get(peerId);
                    const existingAge = existingPeerInfo ? (now - existingPeerInfo.connectedAt) : 0;
                    
                    // Don't replace if ICE is actively negotiating
                    if (isIceActive && existingAge < 20000) {
                        dataConnection.close();
                        return;
                    }
                    
                    // Get replacement attempt info
                    const attemptInfo = connectionAttempts.get(peerId) || { count: 0, firstAttempt: now, lastAttempt: now };
                    
                    // Only replace if conditions are met
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
                    state.dataConnections.delete(peerId);
                    state.connectedPeers.delete(peerId);
                }
            } else {
                // New connection attempt - reset counter if enough time has passed
                const attemptInfo = connectionAttempts.get(peerId);
                if (attemptInfo && (now - attemptInfo.firstAttempt) > 30000) {
                    connectionAttempts.delete(peerId);
                }
            }
            
            setupDataConnection(dataConnection, peerId, state, adapter, handlePeerMessage, setupCallHandlers);
            
            // Clean up attempt tracking when connection opens
            dataConnection.on('open', () => {
                connectionAttempts.delete(peerId);
            });
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if this is a camera call
            const isCameraCall = incomingCall.metadata && incomingCall.metadata.isCameraCall;
            
            if (isCameraCall) {
                // Handle camera call
                if (state.cameraCalls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Answer with our camera stream if available, otherwise dummy stream
                let streamToShare = null;
                if (state.isCameraActive && state.cameraStream) {
                    streamToShare = state.cameraStream;
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
                    incomingCall._isCameraCall = true;
                    setupCallHandlers(incomingCall, peerId);
                    
                    // Ensure tracks are synchronized after connection
                    if (state.isCameraActive && state.cameraStream && typeof window !== 'undefined' && window.shareCameraWithPeers) {
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
                if (state.calls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Answer with current screen share if available, otherwise dummy stream
                let streamToShare = null;
                if (state.mode === 'screen' && state.stream) {
                    streamToShare = state.stream;
                } else if (state.stream) {
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
            
            if (err.type === 'peer-unavailable') {
                // Expected if someone tries to connect before we're ready
            } else if (err.type === 'network') {
                adapter.showAlert('Network error. Please check your internet connection.');
            }
        });

    } catch (err) {
        console.error('Error starting collaboration:', err);
        adapter.showAlert('Failed to start collaboration: ' + err.message);
    }
}

/**
 * Join an existing collaboration session
 * @param {string} code - The share code to join
 * @param {Object} state - The application state
 * @param {Object} adapter - The platform adapter
 * @param {Function} handlePeerMessage - Message handler function
 * @param {Function} setupCallHandlers - Call handler setup function
 * @param {Function} stopCollaborationFn - Function to stop collaboration
 * @param {Object} Peer - PeerJS constructor (optional, will try to get from window)
 */
export async function joinCollaborationWithCode(code, state, adapter, handlePeerMessage, setupCallHandlers, stopCollaborationFn, Peer = null) {
    // Get Peer constructor
    if (!Peer) {
        Peer = initPeerJS();
    }
    
    if (!Peer) {
        adapter.showAlert('PeerJS library not loaded. Please refresh the page.');
        return;
    }
    
    if (!code || code.length !== SHARE_CODE_LENGTH) {
        adapter.showAlert(`Invalid share code. Please enter a ${SHARE_CODE_LENGTH}-character code.`);
        return;
    }

    // Show connecting status
    adapter.updateConnectionStatus(false, null);

    try {
        // Clean up any existing peer
        if (state.peer) {
            state.peer.destroy();
            state.peer = null;
        }

        state.peer = new Peer(PEER_CONFIG);

        let connectionAttempted = false;

        state.peer.on('open', (id) => {
            state.myPeerId = id;
            
            // Initialize chat and participants panel
            adapter.initChat();
            adapter.updateParticipantsPanel();
            
            // Wait a bit to ensure peer is fully ready
            setTimeout(() => {
                if (connectionAttempted) return;
                connectionAttempted = true;
                
                // Create a wrapper for setupDataConnection that includes all required parameters
                const setupDataConnectionWrapper = (dataConnection, peerId) => {
                    setupDataConnection(dataConnection, peerId, state, adapter, handlePeerMessage, setupCallHandlers);
                };
                
                // Connect data channel with retry logic
                attemptConnection(code, 0, stopCollaborationFn, state, adapter, setupDataConnectionWrapper);
            }, 500);
        });

        // Listen for incoming calls from the host
        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check if this is a camera call
            const isCameraCall = incomingCall.metadata && incomingCall.metadata.isCameraCall;
            
            if (isCameraCall) {
                // Handle camera call
                if (state.cameraCalls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Set up handlers FIRST before answering
                state.cameraCalls.set(peerId, incomingCall);
                incomingCall._isCameraCall = true;
                setupCallHandlers(incomingCall, peerId);
                
                // Answer with our camera stream if available, otherwise dummy stream
                let streamToAnswer = null;
                if (state.isCameraActive && state.cameraStream) {
                    streamToAnswer = state.cameraStream;
                } else {
                    // Create dummy stream
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToAnswer) {
                    incomingCall.answer(streamToAnswer);
                    
                    // Ensure tracks are synchronized
                    if (state.isCameraActive && state.cameraStream && typeof window !== 'undefined' && window.shareCameraWithPeers) {
                        setTimeout(() => {
                            if (state.cameraCalls.has(peerId) && state.isCameraActive && state.cameraStream) {
                                window.shareCameraWithPeers(state.cameraStream);
                            }
                        }, 500);
                    }
                } else {
                    try {
                        incomingCall.answer();
                    } catch (e) {
                        console.error('Error answering camera call:', e);
                    }
                }
            } else {
                // Handle screen share call
                if (state.calls.has(peerId)) {
                    incomingCall.close();
                    return;
                }
                
                // Set up handlers FIRST before answering
                state.calls.set(peerId, incomingCall);
                setupCallHandlers(incomingCall, peerId);
                
                // Answer the call
                let streamToAnswer = null;
                if (state.mode === 'screen' && state.stream) {
                    streamToAnswer = state.stream;
                } else if (state.stream) {
                    streamToAnswer = state.stream;
                } else {
                    // Create dummy stream
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    streamToAnswer = canvas.captureStream ? canvas.captureStream(1) : null;
                }
                
                if (streamToAnswer) {
                    incomingCall.answer(streamToAnswer);
                } else {
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
            
            if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect')) {
                setTimeout(() => {
                    adapter.showAlert('Could not connect to host. Please check:\n\n1. The share code is correct\n2. The host is still online\n3. Try again in a moment');
                }, 1000);
            } else if (err.type === 'network') {
                adapter.showAlert('Network error. Please check your internet connection and try again.');
                stopCollaborationFn();
            } else {
                adapter.showAlert('Connection error: ' + (err.message || err.type || 'Unknown error'));
                stopCollaborationFn();
            }
        });

    } catch (err) {
        console.error('Error joining collaboration:', err);
        adapter.showAlert('Failed to join: ' + err.message);
        stopCollaborationFn();
    }
}

/**
 * Stop collaboration and clean up
 * @param {Object} state - The application state
 * @param {Object} adapter - The platform adapter
 */
export function stopCollaboration(state, adapter) {
    // Clear any ongoing connection attempts
    clearOngoingConnections();
    
    // Mark session as available before unregistering (if it was connected)
    if (state.shareCode && state.isHosting) {
        adapter.markSessionAvailable(state.shareCode);
    }
    
    // Unregister from discovery service
    if (state.shareCode && state.isHosting) {
        adapter.unregisterSession(state.shareCode);
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
    if (state.cameraCalls) {
        state.cameraCalls.forEach((call, peerId) => {
            if (call) {
                call.close();
            }
        });
        state.cameraCalls.clear();
    }
    
    // Desktop-specific: Stop camera stream
    if (state.cameraStream && typeof state.cameraStream.getTracks === 'function') {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
        state.isCameraActive = false;
    }
    
    // Clear peer tracking
    state.connectedPeers.clear();
    
    // Desktop-specific: Clear pointers
    if (state.pointers) {
        state.pointers.clear();
    }
    
    // Desktop-specific: Clear chat messages unread count
    if (typeof state.unreadChatCount !== 'undefined') {
        state.unreadChatCount = 0;
    }
    
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    
    state.isCollaborating = false;
    state.isHosting = false;
    state.shareCode = null;
    
    // Web-specific: Clear peer elements
    if (state.peerElements) {
        state.peerElements = [];
    }
    
    state.myPeerId = null;
    
    adapter.removeCodeFromURL();
    adapter.updateConnectionStatus(false);
    adapter.updateParticipantsPanel();
    
    // Web-specific: Redraw canvas
    adapter.redrawCanvas();
}
