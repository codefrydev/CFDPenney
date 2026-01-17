// Data Connection Lifecycle Management
// Shared module for managing peer data connections

import { sendToPeer } from './messageSender.js';
import { normalizeElement } from './coordinateUtils.js';
import { CONNECTION_TIMEOUT, MAX_RETRIES, RETRY_DELAY, CONNECTION_GRACE_PERIOD, MAX_REPLACEMENTS } from '../config/constants.js';

/**
 * Setup data connection handlers
 * @param {Object} dataConnection - The PeerJS data connection
 * @param {string} peerId - The peer ID
 * @param {Object} state - The application state
 * @param {Object} adapter - The platform adapter
 * @param {Function} handlePeerMessage - Message handler function
 * @param {Function} setupCallHandlers - Call handler setup function
 */
export function setupDataConnection(dataConnection, peerId, state, adapter, handlePeerMessage, setupCallHandlers) {
    if (!dataConnection) {
        return;
    }

    const connectionPeerId = peerId || dataConnection.peer;
    const connectionStartTime = Date.now();
    
    // Track connection state transitions for diagnostics
    let lastReadyState = dataConnection.readyState;
    let lastIceState = null;
    let lastIceGatheringState = null;
    
    const logStateChange = (newState, reason) => {
        if (newState !== lastReadyState) {
            lastReadyState = newState;
        }
    };
    
    // Monitor readyState and ICE state changes
    if (dataConnection.peerConnection) {
        const pc = dataConnection.peerConnection;
        
        const checkState = () => {
            const currentState = dataConnection.readyState;
            logStateChange(currentState);
            
            if (pc.iceConnectionState && pc.iceConnectionState !== lastIceState) {
                lastIceState = pc.iceConnectionState;
            }
            
            if (pc.iceGatheringState && pc.iceGatheringState !== lastIceGatheringState) {
                lastIceGatheringState = pc.iceGatheringState;
            }
        };
        
        // Initialize ICE state tracking
        if (pc.iceConnectionState) {
            lastIceState = pc.iceConnectionState;
        }
        if (pc.iceGatheringState) {
            lastIceGatheringState = pc.iceGatheringState;
        }
        
        // Poll for state changes
        const stateCheckInterval = setInterval(() => {
            if (dataConnection.readyState === 'open' || dataConnection.readyState === 'closed') {
                clearInterval(stateCheckInterval);
            } else {
                checkState();
            }
        }, 1000);
        
        // Clear interval when connection closes
        dataConnection.on('close', () => {
            clearInterval(stateCheckInterval);
        });
    }
    
    // Store the connection in the map
    if (!state.dataConnections.has(connectionPeerId)) {
        state.dataConnections.set(connectionPeerId, dataConnection);
        state.connectedPeers.set(connectionPeerId, {
            id: connectionPeerId,
            connectedAt: Date.now()
        });
        
        adapter.updateParticipantsPanel();
    } else {
        // Connection already exists - check if it's the same one or a different one
        const existingConn = state.dataConnections.get(connectionPeerId);
        if (existingConn !== dataConnection) {
            // Different connection object - close the old one if it's not open
            if (!existingConn.open && existingConn.readyState !== 'open') {
                existingConn.close();
                state.dataConnections.set(connectionPeerId, dataConnection);
                state.connectedPeers.set(connectionPeerId, {
                    id: connectionPeerId,
                    connectedAt: Date.now()
                });
                
                adapter.updateParticipantsPanel();
            } else {
                // Existing connection is open, close this duplicate
                dataConnection.close();
                return;
            }
        }
    }

    // Helper function to handle connection open
    const handleConnectionOpen = () => {
        state.isCollaborating = true;
        
        // If on penney page, sync immediately to penneyState
        if (typeof window !== 'undefined' && window.isPenneyPage && window.syncStateForCollaboration) {
            window.syncStateForCollaboration();
        }
        
        adapter.updateConnectionStatus(true, state.shareCode);
        
        // Initialize participants panel
        setTimeout(() => {
            adapter.updateParticipantsPanel();
        }, 100);
        
        // Mark session as connected in discovery service (web only)
        if (state.isHosting && state.shareCode) {
            adapter.markSessionConnected(state.shareCode);
        } else if (!state.isHosting && state.shareCode) {
            adapter.markSessionConnected(state.shareCode);
        }
        
        // Send current canvas state to new peer (only if we're the host)
        if (state.isHosting) {
            // For web app with elements array
            if (state.elements && Array.isArray(state.elements)) {
                const normalizedElements = state.elements.map(el => normalizeElement(el, adapter));
                sendToPeer(state, {
                    type: 'ANNOTATION_SYNC',
                    elements: normalizedElements,
                    historyStep: state.historyStep
                }, connectionPeerId);
            }
            // For desktop app with strokes map
            else if (state.strokes && state.strokes instanceof Map) {
                const overlayState = {
                    strokes: Array.from(state.strokes.values())
                };
                sendToPeer(state, {
                    type: 'OVERLAY_SYNC',
                    state: overlayState
                }, connectionPeerId);
            }
        }
        
        // If we're the host and screen sharing is active, share it with this peer
        if (state.isHosting && state.mode === 'screen' && state.stream && typeof window !== 'undefined' && window.shareScreenWithPeers) {
            setTimeout(() => {
                if (window.shareScreenWithPeers) {
                    window.shareScreenWithPeers(state.stream);
                }
            }, 200);
        } else if (state.isHosting && state.stream && state.peer) {
            // Host should initiate video call to peer
            setTimeout(() => {
                if (state.peer && connectionPeerId && !state.calls.has(connectionPeerId)) {
                    let streamToSend = null;
                    
                    if (state.mode === 'screen' && state.stream) {
                        streamToSend = state.stream;
                    } else if (state.stream) {
                        streamToSend = state.stream;
                    } else {
                        // Create dummy stream for non-screen modes
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        streamToSend = canvas.captureStream ? canvas.captureStream(1) : null;
                    }
                    
                    if (streamToSend) {
                        try {
                            const call = state.peer.call(connectionPeerId, streamToSend);
                            if (call) {
                                state.calls.set(connectionPeerId, call);
                                setupCallHandlers(call, connectionPeerId);
                            }
                        } catch (err) {
                            console.error(`Error initiating call to ${connectionPeerId}:`, err);
                        }
                    }
                }
                
                // Also share camera stream if active
                if (state.cameraStream && state.isCameraActive && state.peer && !state.cameraCalls.has(connectionPeerId)) {
                    try {
                        const cameraCall = state.peer.call(connectionPeerId, state.cameraStream, { metadata: { isCameraCall: true } });
                        if (cameraCall) {
                            state.cameraCalls.set(connectionPeerId, cameraCall);
                            cameraCall._isCameraCall = true;
                            setupCallHandlers(cameraCall, connectionPeerId);
                        }
                    } catch (err) {
                        console.error(`Error initiating camera call to ${connectionPeerId}:`, err);
                    }
                }
            }, 500);
        }
    };

    // If connection is already open, set state immediately
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        handleConnectionOpen();
    } else {
        // Connection not open yet, wait for open event
        const openTimeout = setTimeout(() => {
            // Connection still not open after timeout
        }, 5000);
        
        const openHandler = () => {
            clearTimeout(openTimeout);
            handleConnectionOpen();
        };
        
        dataConnection.on('open', openHandler);
    }

    // Always set up data handlers
    dataConnection.on('data', (data) => {
        try {
            const message = JSON.parse(data);
            handlePeerMessage(message, connectionPeerId);
        } catch (err) {
            console.error('Error parsing peer message:', err, 'raw data:', data);
        }
    });

    dataConnection.on('close', () => {
        // Remove peer from all Maps
        if (connectionPeerId) {
            state.dataConnections.delete(connectionPeerId);
            state.calls.delete(connectionPeerId);
            state.cameraCalls?.delete(connectionPeerId);
            state.connectedPeers.delete(connectionPeerId);
            
            // Desktop-specific cleanup
            if (state.pointers) {
                state.pointers.delete(connectionPeerId);
            }
            
            adapter.updateParticipantsPanel();
        }
        
        // Mark session as available again (only host manages its own availability)
        if (state.isHosting && state.shareCode) {
            adapter.markSessionAvailable(state.shareCode);
        }
        
        // Update collaboration status - check if any connections remain
        if (state.dataConnections.size === 0) {
            state.isCollaborating = false;
            adapter.updateConnectionStatus(false);
        } else {
            adapter.updateConnectionStatus(true, state.shareCode);
        }
    });

    dataConnection.on('error', (err) => {
        const elapsed = Date.now() - connectionStartTime;
        console.error(`[Connection Error] ${connectionPeerId}: Error after ${elapsed}ms, isHosting=${state.isHosting}`, err);
    });
}

// Track ongoing connection attempts to prevent duplicates
const ongoingConnections = new Set();

/**
 * Clear all ongoing connection attempts
 */
export function clearOngoingConnections() {
    ongoingConnections.clear();
}

/**
 * Attempt to connect to a peer
 * @param {string} code - The share code to connect to
 * @param {number} retryCount - Current retry count
 * @param {Function} stopCollaborationFn - Function to call on failure
 * @param {Object} state - The application state
 * @param {Object} adapter - The platform adapter
 * @param {Function} setupDataConnectionFn - The setupDataConnection function
 */
export function attemptConnection(code, retryCount, stopCollaborationFn, state, adapter, setupDataConnectionFn) {
    const connectionStartTime = Date.now();

    // Prevent multiple simultaneous connection attempts for the same code
    if (ongoingConnections.has(code)) {
        return;
    }

    // Check if we already have an open connection
    const existingConnection = state.dataConnections.get(code);
    if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
        return;
    }

    try {
        // Mark that we're attempting a connection
        ongoingConnections.add(code);
        
        // Check if peer is initialized before attempting connection
        if (!state.peer) {
            ongoingConnections.delete(code);
            console.error(`[Connection Attempt] ${code}: Peer is not initialized, cannot connect`);
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn, state, adapter, setupDataConnectionFn), RETRY_DELAY);
            } else {
                console.error(`[Connection Failed] ${code}: Peer not initialized after ${MAX_RETRIES} retries`);
                adapter.showAlert('Connection failed: Peer not initialized. Please try again.');
                if (stopCollaborationFn) stopCollaborationFn();
            }
            return;
        }
        
        // Connect data channel
        const dataConnection = state.peer.connect(code, {
            reliable: true
        });
        
        // Track connection state for diagnostics
        let connectionStateLog = {
            created: Date.now(),
            lastState: dataConnection.readyState,
            stateChanges: []
        };
        
        // Monitor connection state changes
        const logStateChange = () => {
            const currentState = dataConnection.readyState;
            if (currentState !== connectionStateLog.lastState) {
                const elapsed = Date.now() - connectionStateLog.created;
                connectionStateLog.stateChanges.push({
                    state: currentState,
                    time: elapsed
                });
                connectionStateLog.lastState = currentState;
            }
        };
        
        // Poll for state changes
        const stateCheckInterval = setInterval(() => {
            logStateChange();
            if (dataConnection.readyState === 'open' || dataConnection.readyState === 'closed') {
                clearInterval(stateCheckInterval);
            }
        }, 500);

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const hostPeerId = dataConnection.peer || code;
            const elapsed = Date.now() - connectionStartTime;
            
            console.error(`[Connection Timeout] ${code}: Timeout after ${elapsed}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            if (!state.isCollaborating && dataConnection) {
                if (dataConnection) {
                    dataConnection.close();
                    if (state.dataConnections.get(hostPeerId) === dataConnection) {
                        state.dataConnections.delete(hostPeerId);
                        state.connectedPeers.delete(hostPeerId);
                        adapter.updateParticipantsPanel();
                    }
                }
                
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn, state, adapter, setupDataConnectionFn), RETRY_DELAY);
                } else {
                    console.error(`[Connection Failed] ${code}: Timeout after ${MAX_RETRIES} retries`);
                    const iceState = dataConnection.peerConnection?.iceConnectionState;
                    let errorMsg = 'Could not connect to host after multiple attempts. Please check the share code and try again.';
                    if (iceState === 'failed' || iceState === 'disconnected') {
                        errorMsg = 'Connection failed due to network restrictions. This may be due to firewall or NAT settings. Please try:\n\n1. Check your network connection\n2. Try a different network\n3. Ensure both users are on networks that allow peer-to-peer connections';
                    }
                    adapter.showAlert(errorMsg);
                    if (stopCollaborationFn) stopCollaborationFn();
                }
            }
        }, CONNECTION_TIMEOUT);

        dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const hostPeerId = dataConnection.peer || code;
            
            // Check if another connection already opened
            const existingConn = state.dataConnections.get(hostPeerId);
            if (existingConn && existingConn !== dataConnection && (existingConn.open || existingConn.readyState === 'open')) {
                dataConnection.close();
                return;
            }
            
            // Store connection
            state.dataConnections.set(hostPeerId, dataConnection);
            state.connectedPeers.set(hostPeerId, {
                id: hostPeerId,
                connectedAt: Date.now()
            });
            
            adapter.updateParticipantsPanel();
            
            // Store share code for status display
            state.shareCode = code;
            setupDataConnectionFn(dataConnection, hostPeerId);
            
            // If we're already screen sharing, share it with the host
            if (state.mode === 'screen' && state.stream && typeof window !== 'undefined' && window.shareScreenWithPeers) {
                setTimeout(() => {
                    if (window.shareScreenWithPeers) {
                        window.shareScreenWithPeers(state.stream);
                    }
                }, 500);
            }
        });

        dataConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const elapsed = Date.now() - connectionStartTime;
            console.error(`[Connection Error] ${code}: Error after ${elapsed}ms (attempt ${retryCount + 1})`, err);
            
            const hostPeerId = dataConnection.peer || code;
            
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
                adapter.updateParticipantsPanel();
            }
            
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn, state, adapter, setupDataConnectionFn), RETRY_DELAY);
            } else {
                console.error(`[Connection Failed] ${code}: Error after ${MAX_RETRIES} retries`);
                const iceState = dataConnection.peerConnection?.iceConnectionState;
                let errorMsg = 'Failed to establish connection. Please check the share code and try again.';
                if (iceState === 'failed') {
                    errorMsg = 'Connection failed due to network restrictions. This may be due to firewall or NAT settings. Please try:\n\n1. Check your network connection\n2. Try a different network\n3. Ensure both users are on networks that allow peer-to-peer connections';
                }
                adapter.showAlert(errorMsg);
                if (stopCollaborationFn) stopCollaborationFn();
            }
        });

        dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const hostPeerId = dataConnection.peer || code;
            
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
                adapter.updateParticipantsPanel();
            }
            
            if (!state.isCollaborating) {
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn, state, adapter, setupDataConnectionFn), RETRY_DELAY);
                }
            }
        });

    } catch (err) {
        ongoingConnections.delete(code);
        console.error('Error attempting connection:', err);
        if (retryCount < MAX_RETRIES) {
            setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn, state, adapter, setupDataConnectionFn), RETRY_DELAY);
        } else {
            adapter.showAlert('Failed to connect: ' + err.message);
            if (stopCollaborationFn) stopCollaborationFn();
        }
    }
}
