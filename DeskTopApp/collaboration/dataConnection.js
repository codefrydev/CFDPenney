// Data Connection Lifecycle Management (Adapted for Electron)
import { state } from '../state.js';
import { handlePeerMessage } from './messageHandler.js';
import { sendToPeer } from './messageSender.js';

// Forward declare setupCallHandlers (will be defined below or imported)
function setupCallHandlers(call, peerId) {
    if (!call) return;

    call.on('stream', (remoteStream) => {
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
                // Check if call already exists
                if (!state.calls.has(connectionPeerId)) {
                    try {
                        const call = state.peer.call(connectionPeerId, state.stream);
                        if (call) {
                            state.calls.set(connectionPeerId, call);
                            setupCallHandlers(call, connectionPeerId);
                        }
                    } catch (err) {
                        console.error(`[Host] Error initiating call to ${connectionPeerId}:`, err);
                    }
                }
            }
        }
    };

    // Check if connection is already open
    const isAlreadyOpen = dataConnection.open || dataConnection.readyState === 'open';
    if (isAlreadyOpen) {
        handleConnectionOpen();
    } else {
        dataConnection.on('open', () => {
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
        return;
    }

    // Check if already connected
    const existingConnection = state.dataConnections.get(code);
    if (existingConnection && (existingConnection.open || existingConnection.readyState === 'open')) {
        return;
    }

    try {
        ongoingConnections.add(code);
        
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
            
            const hostPeerId = dataConnection.peer || code;
            if (state.dataConnections.get(hostPeerId) === dataConnection) {
                state.dataConnections.delete(hostPeerId);
                state.connectedPeers.delete(hostPeerId);
            }
            
            if (!state.isCollaborating && retryCount < maxRetries) {
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

