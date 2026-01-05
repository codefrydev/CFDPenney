// Data Connection Lifecycle Management
import { state } from '../state.js';
import { showAlert } from '../popupModal.js';
import { markSessionConnected, markSessionAvailable } from '../discovery.js';
import { updateConnectionStatus } from './connectionStatus.js';
import { sendToPeer } from './messageSender.js';
import { normalizeElement } from './coordinateUtils.js';
import { handlePeerMessage } from './messageHandler.js';
import { setupCallHandlers } from './videoCall.js';

export function setupDataConnection(dataConnection, peerId) {
    if (!dataConnection) {
        return;
    }

    const connectionPeerId = peerId || dataConnection.peer;

    // Helper function to handle connection open
    const handleConnectionOpen = () => {
        state.isCollaborating = true;
        updateConnectionStatus(true, state.shareCode);
        
        // Mark session as connected in discovery service
        if (state.isHosting && state.shareCode) {
            markSessionConnected(state.shareCode).catch(err => {
                console.warn('Failed to mark session as connected:', err);
            });
        } else if (!state.isHosting && state.shareCode) {
            // Joiner marks the target session as connected
            markSessionConnected(state.shareCode).catch(err => {
                console.warn('Failed to mark target session as connected:', err);
            });
        }
        
        // Send current canvas state to new peer (only if we're the host)
        // Use sendToPeer for targeted message to this specific peer
        // Normalize coordinates for cross-resolution compatibility
        if (state.isHosting) {
            const normalizedElements = state.elements.map(el => normalizeElement(el));
            sendToPeer({
                type: 'ANNOTATION_SYNC',
                elements: normalizedElements,
                historyStep: state.historyStep
            }, connectionPeerId);
        }
        
        // If we're the host and screen sharing is active, share it with this peer
        if (state.isHosting && state.mode === 'screen' && state.stream && window.shareScreenWithPeers) {
            // Small delay to ensure peer connection is ready
            setTimeout(() => {
                if (window.shareScreenWithPeers) {
                    window.shareScreenWithPeers(state.stream);
                }
            }, 200);
        } else if (state.isHosting) {
            // Host should initiate video call to peer even if not screen sharing
            // This establishes the media connection for when screen sharing starts
            setTimeout(() => {
                if (state.peer && connectionPeerId && !state.calls.has(connectionPeerId)) {
                    let streamToSend = null;
                    
                    // If screen sharing is active, use that stream
                    if (state.mode === 'screen' && state.stream) {
                        streamToSend = state.stream;
                        console.log(`Host initiating call to peer ${connectionPeerId} with screen stream`);
                    } else {
                        // Create dummy stream for non-screen modes
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        streamToSend = canvas.captureStream ? canvas.captureStream(1) : null;
                        console.log(`Host initiating call to peer ${connectionPeerId} with dummy stream`);
                    }
                    
                    if (streamToSend) {
                        try {
                            const call = state.peer.call(connectionPeerId, streamToSend);
                            if (call) {
                                state.calls.set(connectionPeerId, call);
                                setupCallHandlers(call, connectionPeerId);
                                console.log(`Host successfully initiated call to peer ${connectionPeerId}`);
                            } else {
                                console.error(`Host failed to create call to peer ${connectionPeerId}`);
                            }
                        } catch (err) {
                            console.error(`Error host initiating call to ${connectionPeerId}:`, err);
                        }
                    } else {
                        console.error(`Host: No stream available to call peer ${connectionPeerId}`);
                    }
                } else {
                    if (state.calls.has(connectionPeerId)) {
                        console.log(`Host: Call to peer ${connectionPeerId} already exists`);
                    }
                }
            }, 500); // Increased delay to ensure peer is ready
        }
    };

    // If connection is already open (e.g., peer initiated connection), set state immediately
    // Check both 'open' property and readyState for reliability
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        handleConnectionOpen();
    } else {
        // Connection not open yet, wait for open event
        dataConnection.on('open', handleConnectionOpen);
    }

    // Always set up data handlers (regardless of connection state)
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
            state.connectedPeers.delete(connectionPeerId);
        }
        
        // Mark session as available again (only host manages its own availability)
        // Host stays available for new connections when a peer disconnects
        if (state.isHosting && state.shareCode) {
            markSessionAvailable(state.shareCode).catch(err => {
                console.warn('Failed to mark session as available:', err);
            });
        }
        // Joiners don't manage host session availability - host handles it
        
        // Update collaboration status - check if any connections remain
        if (state.dataConnections.size === 0) {
            state.isCollaborating = false;
            updateConnectionStatus(false);
        } else {
            // Still have other connections, just update status
            updateConnectionStatus(true, state.shareCode);
        }
    });

    dataConnection.on('error', (err) => {
        console.error(`Data connection error for peer ${connectionPeerId}, isHosting:`, state.isHosting, err);
    });
}

function initiateVideoCall(code) {
    try {
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
        
        if (state.peer) {
            // Create call to host (peer initiates call to receive host's stream)
            // Pass null or dummy stream - the host will answer with their stream
            const call = state.peer.call(code, streamToShare || null);
            
            if (call) {
                console.log(`Initiating video call to host ${code}`);
                state.calls.set(code, call);
                
                // Set up handlers to receive the host's stream
                setupCallHandlers(call, code);
                
                // Also listen for stream event (when host answers)
                call.on('stream', (remoteStream) => {
                    console.log(`Received stream from host ${code} via initiated call`);
                    // setupCallHandlers should handle this, but ensure it's processed
                });
            } else {
                console.error('Failed to create call to host');
            }
        } else {
            console.error('No peer instance available to initiate call');
        }
    } catch (err) {
        console.error('Error initiating video call:', err);
        // Video call failure is not critical if data connection works
    }
}

// Track ongoing connection attempts to prevent duplicates
const ongoingConnections = new Set();

// Clear all ongoing connection attempts (used when stopping collaboration)
export function clearOngoingConnections() {
    ongoingConnections.clear();
}

export function attemptConnection(code, retryCount = 0, stopCollaborationFn) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    // Prevent multiple simultaneous connection attempts for the same code
    if (ongoingConnections.has(code)) {
        console.log(`Connection attempt to ${code} already in progress, skipping duplicate`);
        return;
    }

    // Check if we already have an open connection
    const existingConnection = state.dataConnections.get(code);
    if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
        console.log(`Connection to ${code} already exists and is open`);
        return;
    }

    try {
        // Mark that we're attempting a connection
        ongoingConnections.add(code);
        
        // Connect data channel
        const dataConnection = state.peer.connect(code, {
            reliable: true
        });

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            ongoingConnections.delete(code);
            if (!state.isCollaborating && dataConnection) {
                if (dataConnection) {
                    dataConnection.close();
                    // Only delete if this is still the active connection
                    if (state.dataConnections.get(code) === dataConnection) {
                        state.dataConnections.delete(code);
                        state.connectedPeers.delete(code);
                    }
                }
                
                if (retryCount < maxRetries) {
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
                } else {
                    showAlert('Could not connect to host after multiple attempts. Please check the share code and try again.');
                    if (stopCollaborationFn) stopCollaborationFn();
                }
            }
        }, 10000); // 10 second timeout

        dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            
            // Check if another connection already opened (race condition protection)
            const existingConn = state.dataConnections.get(code);
            if (existingConn && existingConn !== dataConnection && (existingConn.open || existingConn.readyState === 'open')) {
                console.log(`Another connection to ${code} already opened, closing duplicate`);
                dataConnection.close();
                return;
            }
            
            // Store connection in Map only when it's confirmed open (for joiners, there's only one connection)
            state.dataConnections.set(code, dataConnection);
            state.connectedPeers.set(code, {
                id: code,
                connectedAt: Date.now()
            });
            
            // Store share code for status display
            state.shareCode = code;
            setupDataConnection(dataConnection, code);
            
            // As a peer joining, we wait for the host to call us
            // The host will initiate the video call when they receive our data connection
            // We don't need to call initiateVideoCall here - that was for the old flow
            // Instead, we just wait for the host's incoming call
            
            // If we're already screen sharing, we can share it with the host
            if (state.mode === 'screen' && state.stream && window.shareScreenWithPeers) {
                setTimeout(() => {
                    if (window.shareScreenWithPeers) {
                        window.shareScreenWithPeers(state.stream);
                    }
                }, 500);
            }
        });

        dataConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            console.error('Data connection error:', err);
            
            // Only delete if this is still the active connection
            if (state.dataConnections.get(code) === dataConnection) {
                state.dataConnections.delete(code);
                state.connectedPeers.delete(code);
            }
            
            if (retryCount < maxRetries) {
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
            } else {
                showAlert('Failed to establish connection. Please check the share code and try again.');
                if (stopCollaborationFn) stopCollaborationFn();
            }
        });

        dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            
            // Only delete if this is still the active connection
            if (state.dataConnections.get(code) === dataConnection) {
                state.dataConnections.delete(code);
                state.connectedPeers.delete(code);
            }
            
            if (!state.isCollaborating) {
                if (retryCount < maxRetries) {
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
                }
            }
        });

    } catch (err) {
        ongoingConnections.delete(code);
        console.error('Error attempting connection:', err);
        if (retryCount < maxRetries) {
            setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
        } else {
            showAlert('Failed to connect: ' + err.message);
            if (stopCollaborationFn) stopCollaborationFn();
        }
    }
}

