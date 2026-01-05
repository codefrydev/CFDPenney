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
    const connectionStartTime = Date.now();
    
    // Track connection state transitions for diagnostics
    let lastReadyState = dataConnection.readyState;
    let lastIceState = null;
    let lastIceGatheringState = null;
    
    const logStateChange = (newState, reason) => {
        if (newState !== lastReadyState) {
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection State] ${connectionPeerId}: ${lastReadyState} -> ${newState} (${elapsed}ms)${reason ? ` - ${reason}` : ''}`);
            lastReadyState = newState;
        }
    };
    
    // Monitor readyState and ICE state changes (only log when state actually changes)
    if (dataConnection.peerConnection) {
        const pc = dataConnection.peerConnection;
        
        const checkState = () => {
            const currentState = dataConnection.readyState;
            logStateChange(currentState);
            
            // Only log ICE state when it actually changes
            if (pc.iceConnectionState && pc.iceConnectionState !== lastIceState) {
                const elapsed = Date.now() - connectionStartTime;
                console.log(`[ICE State] ${connectionPeerId}: ${lastIceState || 'initial'} -> ${pc.iceConnectionState} (${elapsed}ms), gathering: ${pc.iceGatheringState}`);
                lastIceState = pc.iceConnectionState;
            }
            
            if (pc.iceGatheringState && pc.iceGatheringState !== lastIceGatheringState) {
                const elapsed = Date.now() - connectionStartTime;
                console.log(`[ICE Gathering] ${connectionPeerId}: ${lastIceGatheringState || 'initial'} -> ${pc.iceGatheringState} (${elapsed}ms)`);
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
        
        // Poll for state changes (PeerJS doesn't always emit readyState change events)
        const stateCheckInterval = setInterval(() => {
            if (dataConnection.readyState === 'open' || dataConnection.readyState === 'closed') {
                clearInterval(stateCheckInterval);
            } else {
                checkState();
            }
        }, 1000); // Reduced frequency to 1 second to reduce noise
        
        // Clear interval when connection closes
        dataConnection.on('close', () => {
            clearInterval(stateCheckInterval);
        });
    }
    
    // Store the connection in the map when setting up (for tracking and duplicate detection)
    // Note: For host, peerId is the joining peer's ID. For joiner, peerId is the host's ID (share code)
    if (!state.dataConnections.has(connectionPeerId)) {
        state.dataConnections.set(connectionPeerId, dataConnection);
        state.connectedPeers.set(connectionPeerId, {
            id: connectionPeerId,
            connectedAt: Date.now()
        });
        console.log(`[Connection Setup] ${connectionPeerId}: Initial setup, open=${dataConnection.open}, readyState=${dataConnection.readyState}`);
    } else {
        // Connection already exists - check if it's the same one or a different one
        const existingConn = state.dataConnections.get(connectionPeerId);
        if (existingConn !== dataConnection) {
            // Different connection object - close the old one if it's not open
            if (!existingConn.open && existingConn.readyState !== 'open') {
                const existingAge = Date.now() - (state.connectedPeers.get(connectionPeerId)?.connectedAt || Date.now());
                console.log(`[Connection Replacement] ${connectionPeerId}: Replacing stale connection (age: ${existingAge}ms, open=${existingConn.open}, readyState=${existingConn.readyState})`);
                existingConn.close();
                state.dataConnections.set(connectionPeerId, dataConnection);
                state.connectedPeers.set(connectionPeerId, {
                    id: connectionPeerId,
                    connectedAt: Date.now()
                });
            } else {
                // Existing connection is open, close this duplicate
                console.log(`[Connection Duplicate] ${connectionPeerId}: Existing connection is open, closing duplicate`);
                dataConnection.close();
                return;
            }
        }
    }

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
        const elapsed = Date.now() - connectionStartTime;
        console.log(`[Connection Open] ${connectionPeerId}: Already open (${elapsed}ms)`);
        handleConnectionOpen();
    } else {
        // Connection not open yet, wait for open event
        const elapsed = Date.now() - connectionStartTime;
        console.log(`[Connection Pending] ${connectionPeerId}: Waiting for open event (current: open=${dataConnection.open}, readyState=${dataConnection.readyState}, ${elapsed}ms since setup)`);
        
        // Set up open handler with timeout warning
        const openTimeout = setTimeout(() => {
            const elapsedSinceSetup = Date.now() - connectionStartTime;
            console.warn(`[Connection Warning] ${connectionPeerId}: Still not open after ${elapsedSinceSetup}ms, open=${dataConnection.open}, readyState=${dataConnection.readyState}`);
        }, 5000); // Warn after 5 seconds
        
        const openHandler = () => {
            clearTimeout(openTimeout);
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection Opened] ${connectionPeerId}: Open event fired (${elapsed}ms since setup)`);
            handleConnectionOpen();
        };
        
        dataConnection.on('open', openHandler);
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
        const elapsed = Date.now() - connectionStartTime;
        console.log(`[Connection Closed] ${connectionPeerId}: Closed after ${elapsed}ms`);
        
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
        const elapsed = Date.now() - connectionStartTime;
        console.error(`[Connection Error] ${connectionPeerId}: Error after ${elapsed}ms, isHosting=${state.isHosting}`, err);
        console.error(`[Connection Error Details] ${connectionPeerId}:`, {
            errorType: err.type,
            errorMessage: err.message,
            error: err,
            connectionOpen: dataConnection.open,
            readyState: dataConnection.readyState,
            peerConnectionState: dataConnection.peerConnection?.connectionState,
            iceConnectionState: dataConnection.peerConnection?.iceConnectionState,
            iceGatheringState: dataConnection.peerConnection?.iceGatheringState
        });
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
    const CONNECTION_TIMEOUT = 15000; // 15 seconds (increased from 10 for production)
    const connectionStartTime = Date.now();

    // Prevent multiple simultaneous connection attempts for the same code
    if (ongoingConnections.has(code)) {
        console.log(`[Connection Attempt] ${code}: Already in progress, skipping duplicate`);
        return;
    }

    // Check if we already have an open connection
    // Note: We check by code (share code) which is the host's peer ID
    const existingConnection = state.dataConnections.get(code);
    if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
        console.log(`[Connection Attempt] ${code}: Already exists and is open`);
        return;
    }

    try {
        // Mark that we're attempting a connection
        ongoingConnections.add(code);
        console.log(`[Connection Attempt] ${code}: Starting attempt ${retryCount + 1}/${maxRetries + 1}`);
        
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
                console.log(`[Connection State] ${code}: ${connectionStateLog.lastState} -> ${currentState} (${elapsed}ms)`);
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

        // Set connection timeout with better diagnostics
        const connectionTimeout = setTimeout(() => {
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            // Get the peer ID from the connection if available
            const hostPeerId = dataConnection.peer || code;
            const elapsed = Date.now() - connectionStartTime;
            
            // Log detailed timeout information
            console.error(`[Connection Timeout] ${code}: Timeout after ${elapsed}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
            console.error(`[Connection Timeout Details] ${code}:`, {
                open: dataConnection.open,
                readyState: dataConnection.readyState,
                stateChanges: connectionStateLog.stateChanges,
                peerConnectionState: dataConnection.peerConnection?.connectionState,
                iceConnectionState: dataConnection.peerConnection?.iceConnectionState,
                iceGatheringState: dataConnection.peerConnection?.iceGatheringState
            });
            
            if (!state.isCollaborating && dataConnection) {
                if (dataConnection) {
                    dataConnection.close();
                    // Only delete if this is still the active connection (use hostPeerId as key)
                    if (state.dataConnections.get(hostPeerId) === dataConnection) {
                        state.dataConnections.delete(hostPeerId);
                        state.connectedPeers.delete(hostPeerId);
                    }
                }
                
                if (retryCount < maxRetries) {
                    console.log(`[Connection Retry] ${code}: Retrying (${retryCount + 1}/${maxRetries})...`);
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
                } else {
                    console.error(`[Connection Failed] ${code}: Timeout after ${maxRetries} retries`);
                    showAlert('Could not connect to host after multiple attempts. Please check the share code and try again.');
                    if (stopCollaborationFn) stopCollaborationFn();
                }
            }
        }, CONNECTION_TIMEOUT);

        dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            // Get the actual peer ID from the connection (this is the host's peer ID, which is the share code)
            const hostPeerId = dataConnection.peer || code;
            const elapsed = Date.now() - connectionStartTime;
            
            console.log(`[Connection Success] ${code}: Opened to host ${hostPeerId} in ${elapsed}ms (attempt ${retryCount + 1})`);
            console.log(`[Connection Success Details] ${code}:`, {
                stateChanges: connectionStateLog.stateChanges,
                totalStateChanges: connectionStateLog.stateChanges.length
            });
            
            // Check if another connection already opened (race condition protection)
            // Use hostPeerId as the key to match how host stores connections
            const existingConn = state.dataConnections.get(hostPeerId);
            if (existingConn && existingConn !== dataConnection && (existingConn.open || existingConn.readyState === 'open')) {
                console.log(`[Connection Duplicate] ${code}: Another connection to ${hostPeerId} already opened, closing duplicate`);
                dataConnection.close();
                return;
            }
            
            // Store connection in Map using the host's peer ID (which is the share code)
            // This matches how the host stores connections
            state.dataConnections.set(hostPeerId, dataConnection);
            state.connectedPeers.set(hostPeerId, {
                id: hostPeerId,
                connectedAt: Date.now()
            });
            
            // Store share code for status display
            state.shareCode = code;
            setupDataConnection(dataConnection, hostPeerId);
            
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
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const elapsed = Date.now() - connectionStartTime;
            console.error(`[Connection Error] ${code}: Error after ${elapsed}ms (attempt ${retryCount + 1})`, err);
            console.error(`[Connection Error Details] ${code}:`, {
                errorType: err.type,
                errorMessage: err.message,
                error: err,
                open: dataConnection.open,
                readyState: dataConnection.readyState,
                stateChanges: connectionStateLog.stateChanges,
                peerConnectionState: dataConnection.peerConnection?.connectionState,
                iceConnectionState: dataConnection.peerConnection?.iceConnectionState,
                iceGatheringState: dataConnection.peerConnection?.iceGatheringState
            });
            
            // Get the peer ID from the connection if available
            const hostPeerId = dataConnection.peer || code;
            
            // Only delete if this is still the active connection (use hostPeerId as key)
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
            }
            
            if (retryCount < maxRetries) {
                console.log(`[Connection Retry] ${code}: Retrying after error (${retryCount + 1}/${maxRetries})...`);
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
            } else {
                console.error(`[Connection Failed] ${code}: Error after ${maxRetries} retries`);
                showAlert('Failed to establish connection. Please check the share code and try again.');
                if (stopCollaborationFn) stopCollaborationFn();
            }
        });

        dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            clearInterval(stateCheckInterval);
            ongoingConnections.delete(code);
            
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection Closed] ${code}: Closed after ${elapsed}ms (attempt ${retryCount + 1})`);
            
            // Get the peer ID from the connection if available
            const hostPeerId = dataConnection.peer || code;
            
            // Only delete if this is still the active connection (use hostPeerId as key)
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
            }
            
            if (!state.isCollaborating) {
                if (retryCount < maxRetries) {
                    console.log(`[Connection Retry] ${code}: Retrying after close (${retryCount + 1}/${maxRetries})...`);
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

