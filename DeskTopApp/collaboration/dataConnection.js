// Data Connection Lifecycle Management (Adapted for Electron)
import { state } from '../state.js';
import { handlePeerMessage } from './messageHandler.js';
import { sendToPeer } from './messageSender.js';

// Forward declare setupCallHandlers (will be defined below or imported)
function setupCallHandlers(call, peerId) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
        console.log(`[Call] Received stream from ${peerId}`);
        
        // Display stream in video element
        const videoElem = document.getElementById('screen-video');
        if (videoElem) {
            videoElem.srcObject = remoteStream;
            videoElem.play().catch(err => {
                if (err.name !== 'AbortError') {
                    console.warn('Error playing remote stream:', err);
                }
            });
        }
    });

    call.on('close', () => {
        console.log(`[Call] Closed for peer ${peerId}`);
        state.calls.delete(peerId);
    });

    call.on('error', (err) => {
        console.error(`[Call] Error for peer ${peerId}:`, err);
    });
}

export function setupDataConnection(dataConnection, peerId) {
    if (!dataConnection) {
        return;
    }

    const connectionPeerId = peerId || dataConnection.peer;
    const connectionStartTime = Date.now();
    
    console.log(`[Connection Setup] ${connectionPeerId}: Setting up data connection`);
    
    // Store the connection
    if (!state.dataConnections.has(connectionPeerId)) {
        state.dataConnections.set(connectionPeerId, dataConnection);
        state.connectedPeers.set(connectionPeerId, {
            id: connectionPeerId,
            connectedAt: Date.now()
        });
    }

    // Helper function to handle connection open
    const handleConnectionOpen = () => {
        state.isCollaborating = true;
        console.log(`[Connection Opened] ${connectionPeerId}: Connection is now open`);
        
        // Update UI if available
        if (window.updateConnectionStatus) {
            window.updateConnectionStatus(true, state.shareCode);
        }
        
        // If we're the host, send initial state to new peer
        if (state.isHosting) {
            // Send overlay state
            const overlayState = {
                strokes: Array.from(state.strokes.values())
            };
            
            sendToPeer({
                type: 'OVERLAY_SYNC',
                state: overlayState
            }, connectionPeerId);
            
            // Share screen stream with the new peer if available
            if (state.stream && state.peer) {
                console.log(`[Host] Sharing screen stream with peer ${connectionPeerId}`);
                
                // Check if call already exists
                if (!state.calls.has(connectionPeerId)) {
                    try {
                        const call = state.peer.call(connectionPeerId, state.stream);
                        if (call) {
                            state.calls.set(connectionPeerId, call);
                            setupCallHandlers(call, connectionPeerId);
                            console.log(`[Host] Successfully initiated call to peer ${connectionPeerId}`);
                        } else {
                            console.error(`[Host] Failed to create call to peer ${connectionPeerId}`);
                        }
                    } catch (err) {
                        console.error(`[Host] Error initiating call to ${connectionPeerId}:`, err);
                    }
                } else {
                    console.log(`[Host] Call to peer ${connectionPeerId} already exists`);
                }
            } else {
                console.log(`[Host] No stream available yet to share with peer ${connectionPeerId}`);
            }
        }
    };

    // Check if connection is already open
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        console.log(`[Connection Open] ${connectionPeerId}: Already open`);
        handleConnectionOpen();
    } else {
        dataConnection.on('open', () => {
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection Opened] ${connectionPeerId}: Open event fired (${elapsed}ms since setup)`);
            handleConnectionOpen();
        });
    }

    // Set up data handlers
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
            state.pointers.delete(connectionPeerId);
        }
        
        // Update collaboration status
        if (state.dataConnections.size === 0) {
            state.isCollaborating = false;
            if (window.updateConnectionStatus) {
                window.updateConnectionStatus(false);
            }
        }
    });

    dataConnection.on('error', (err) => {
        const elapsed = Date.now() - connectionStartTime;
        console.error(`[Connection Error] ${connectionPeerId}: Error after ${elapsed}ms`, err);
    });
}

// Track ongoing connection attempts
const ongoingConnections = new Set();

export function clearOngoingConnections() {
    ongoingConnections.clear();
}

export function attemptConnection(code, retryCount = 0, stopCollaborationFn) {
    const maxRetries = 3;
    const retryDelay = 2000;
    const CONNECTION_TIMEOUT = 15000;
    const connectionStartTime = Date.now();

    // Prevent duplicates
    if (ongoingConnections.has(code)) {
        console.log(`[Connection Attempt] ${code}: Already in progress`);
        return;
    }

    // Check if already connected
    const existingConnection = state.dataConnections.get(code);
    if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
        console.log(`[Connection Attempt] ${code}: Already connected`);
        return;
    }

    try {
        ongoingConnections.add(code);
        console.log(`[Connection Attempt] ${code}: Starting attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        const dataConnection = state.peer.connect(code, {
            reliable: true
        });

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            ongoingConnections.delete(code);
            const elapsed = Date.now() - connectionStartTime;
            console.error(`[Connection Timeout] ${code}: Timeout after ${elapsed}ms`);
            
            if (!state.isCollaborating && dataConnection) {
                dataConnection.close();
                state.dataConnections.delete(code);
                state.connectedPeers.delete(code);
                
                if (retryCount < maxRetries) {
                    console.log(`[Connection Retry] ${code}: Retrying...`);
                    setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
                } else {
                    console.error(`[Connection Failed] ${code}: Timeout after ${maxRetries} retries`);
                    if (window.showAlert) {
                        window.showAlert('Could not connect to host. Please check the share code and try again.');
                    }
                    if (stopCollaborationFn) stopCollaborationFn();
                }
            }
        }, CONNECTION_TIMEOUT);

        dataConnection.on('open', () => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            
            const hostPeerId = dataConnection.peer || code;
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection Success] ${code}: Opened to host ${hostPeerId} in ${elapsed}ms`);
            
            state.dataConnections.set(hostPeerId, dataConnection);
            state.connectedPeers.set(hostPeerId, {
                id: hostPeerId,
                connectedAt: Date.now()
            });
            state.shareCode = code;
            
            setupDataConnection(dataConnection, hostPeerId);
        });

        dataConnection.on('error', (err) => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            
            const elapsed = Date.now() - connectionStartTime;
            console.error(`[Connection Error] ${code}: Error after ${elapsed}ms`, err);
            
            const hostPeerId = dataConnection.peer || code;
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
            }
            
            if (retryCount < maxRetries) {
                console.log(`[Connection Retry] ${code}: Retrying after error...`);
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
            } else {
                console.error(`[Connection Failed] ${code}: Error after ${maxRetries} retries`);
                if (window.showAlert) {
                    window.showAlert('Failed to establish connection. Please try again.');
                }
                if (stopCollaborationFn) stopCollaborationFn();
            }
        });

        dataConnection.on('close', () => {
            clearTimeout(connectionTimeout);
            ongoingConnections.delete(code);
            
            const elapsed = Date.now() - connectionStartTime;
            console.log(`[Connection Closed] ${code}: Closed after ${elapsed}ms`);
            
            const hostPeerId = dataConnection.peer || code;
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
            }
            
            if (!state.isCollaborating && retryCount < maxRetries) {
                console.log(`[Connection Retry] ${code}: Retrying after close...`);
                setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
            }
        });

    } catch (err) {
        ongoingConnections.delete(code);
        console.error('Error attempting connection:', err);
        if (retryCount < maxRetries) {
            setTimeout(() => attemptConnection(code, retryCount + 1, stopCollaborationFn), retryDelay);
        } else {
            if (window.showAlert) {
                window.showAlert('Failed to connect: ' + err.message);
            }
            if (stopCollaborationFn) stopCollaborationFn();
        }
    }
}

