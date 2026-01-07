// Main Collaboration Lifecycle (Adapted for Electron)
import { state } from '../state.js';
import { setupDataConnection, attemptConnection, clearOngoingConnections } from './dataConnection.js';

// PeerJS will be loaded from CDN or installed via npm
let Peer = null;

// Initialize PeerJS (must be called after window loads)
export function initPeerJS() {
    if (typeof window.Peer !== 'undefined') {
        Peer = window.Peer;
    } else {
        console.error('PeerJS not loaded. Please include PeerJS library.');
    }
}

export async function startCollaboration() {
    if (!Peer) {
        initPeerJS();
    }
    
    if (!Peer) {
        console.error('PeerJS not available');
        if (window.showAlert) {
            window.showAlert('PeerJS library not loaded. Please refresh the page.');
        }
        return;
    }

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

        state.isHosting = true;
        state.shareCode = shareCode;

        state.peer.on('open', (id) => {
            state.myPeerId = id;
            
            if (window.updateConnectionStatus) {
                window.updateConnectionStatus(false, shareCode);
            }
        });

        state.peer.on('connection', (dataConnection) => {
            const peerId = dataConnection.peer;
            
            // Check for existing connection
            const existingConnection = state.dataConnections.get(peerId);
            if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
                dataConnection.close();
                return;
            }
            
            setupDataConnection(dataConnection, peerId);
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            // Check for existing call
            if (state.calls.has(peerId)) {
                incomingCall.close();
                return;
            }
            
            // Answer with screen stream if available
            if (state.stream) {
                incomingCall.answer(state.stream);
                state.calls.set(peerId, incomingCall);
                setupCallHandlers(incomingCall, peerId);
            } else {
                incomingCall.close();
            }
        });

        state.peer.on('error', (err) => {
            console.error('Peer error (host):', err);
            if (window.showAlert) {
                window.showAlert('Connection error: ' + (err.message || 'Unknown error'));
            }
        });

    } catch (err) {
        console.error('Error starting collaboration:', err);
        if (window.showAlert) {
            window.showAlert('Failed to start collaboration: ' + err.message);
        }
    }
}

export async function joinCollaborationWithCode(code) {
    if (!Peer) {
        initPeerJS();
    }
    
    if (!Peer) {
        console.error('PeerJS not available');
        return;
    }
    
    if (!code || code.length !== 5) {
        if (window.showAlert) {
            window.showAlert('Invalid share code. Please enter a 5-character code.');
        }
        return;
    }

    try {
        // Clean up existing peer
        if (state.peer) {
            state.peer.destroy();
            state.peer = null;
        }

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

        let connectionAttempted = false;

        state.peer.on('open', (id) => {
            state.myPeerId = id;
            
            setTimeout(() => {
                if (connectionAttempted) return;
                connectionAttempted = true;
                attemptConnection(code, 0, stopCollaboration);
            }, 500);
        });

        state.peer.on('call', (incomingCall) => {
            const peerId = incomingCall.peer;
            
            if (state.calls.has(peerId)) {
                incomingCall.close();
                return;
            }
            
            // Answer and set up handlers
            state.calls.set(peerId, incomingCall);
            setupCallHandlers(incomingCall, peerId);
            incomingCall.answer(); // Answer without sending a stream
        });

        state.peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (window.showAlert) {
                window.showAlert('Connection error: ' + (err.message || 'Unknown error'));
            }
            stopCollaboration();
        });

    } catch (err) {
        console.error('Error joining collaboration:', err);
        if (window.showAlert) {
            window.showAlert('Failed to join: ' + err.message);
        }
        stopCollaboration();
    }
}

export function stopCollaboration() {
    clearOngoingConnections();
    
    // Close all data connections
    state.dataConnections.forEach((conn) => {
        if (conn) conn.close();
    });
    state.dataConnections.clear();
    
    // Close all calls
    state.calls.forEach((call) => {
        if (call) call.close();
    });
    state.calls.clear();
    
    // Clear peer tracking
    state.connectedPeers.clear();
    state.pointers.clear();
    
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
    
    state.isCollaborating = false;
    state.isHosting = false;
    state.shareCode = null;
    state.myPeerId = null;
    
    if (window.updateConnectionStatus) {
        window.updateConnectionStatus(false);
    }
}

function setupCallHandlers(call, peerId) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        // Display stream in video element
        const videoElem = document.getElementById('screen-video');
        if (videoElem) {
            videoElem.srcObject = remoteStream;
            videoElem.play().catch(err => {
                if (err.name !== 'AbortError') {
                }
            });
        }
    });

    call.on('close', () => {
        state.calls.delete(peerId);
    });

    call.on('error', (err) => {
        console.error(`[Call] Error for peer ${peerId}:`, err);
    });
}

