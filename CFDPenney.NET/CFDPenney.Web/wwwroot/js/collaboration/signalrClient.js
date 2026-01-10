// SignalR Client Wrapper for Collaboration
// This replaces PeerJS functionality with SignalR

let connection = null;
let isConnected = false;
let currentSessionCode = null;
let connectionCallbacks = {
    onOpen: null,
    onClose: null,
    onError: null,
    onDrawingAction: null,
    onChatMessage: null,
    onCursorUpdate: null,
    onStateUpdate: null,
    onParticipantJoined: null,
    onParticipantLeft: null,
    onSessionJoined: null,
    onTypingIndicator: null,
    onTypingStopped: null
};

export function initializeSignalR() {
    if (connection) {
        return connection;
    }

    // Create SignalR connection
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/collaborationHub")
        .withAutomaticReconnect()
        .build();

    // Connection event handlers
    connection.onclose(() => {
        isConnected = false;
        if (connectionCallbacks.onClose) {
            connectionCallbacks.onClose();
        }
    });

    connection.onreconnecting(() => {
        console.log('[SignalR] Reconnecting...');
    });

    connection.onreconnected(() => {
        console.log('[SignalR] Reconnected');
        isConnected = true;
        if (currentSessionCode) {
            // Rejoin session if we were in one
            joinSession(currentSessionCode, generatePeerId(), 'Guest');
        }
    });

    // Hub method handlers
    connection.on("DrawingAction", (action) => {
        if (connectionCallbacks.onDrawingAction) {
            connectionCallbacks.onDrawingAction(action);
        }
    });

    connection.on("ChatMessage", (message) => {
        if (connectionCallbacks.onChatMessage) {
            connectionCallbacks.onChatMessage(message);
        }
    });

    connection.on("CursorUpdate", (data) => {
        if (connectionCallbacks.onCursorUpdate) {
            connectionCallbacks.onCursorUpdate(data);
        }
    });

    connection.on("StateUpdate", (state) => {
        if (connectionCallbacks.onStateUpdate) {
            connectionCallbacks.onStateUpdate(state);
        }
    });

    connection.on("ParticipantJoined", (participant) => {
        if (connectionCallbacks.onParticipantJoined) {
            connectionCallbacks.onParticipantJoined(participant);
        }
    });

    connection.on("ParticipantLeft", (data) => {
        if (connectionCallbacks.onParticipantLeft) {
            connectionCallbacks.onParticipantLeft(data);
        }
    });

    connection.on("SessionJoined", (data) => {
        if (connectionCallbacks.onSessionJoined) {
            connectionCallbacks.onSessionJoined(data);
        }
    });

    connection.on("TypingIndicator", (data) => {
        if (connectionCallbacks.onTypingIndicator) {
            connectionCallbacks.onTypingIndicator(data);
        }
    });

    connection.on("TypingStopped", (data) => {
        if (connectionCallbacks.onTypingStopped) {
            connectionCallbacks.onTypingStopped(data);
        }
    });

    return connection;
}

export async function startConnection() {
    if (!connection) {
        initializeSignalR();
    }

    // If already connected, return immediately
    if (connection.state === signalR.HubConnectionState.Connected) {
        return connection;
    }

    // If already connecting, wait for it to complete
    if (connection.state === signalR.HubConnectionState.Connecting) {
        // Wait for connection to complete or fail
        return new Promise((resolve, reject) => {
            const checkConnection = setInterval(() => {
                if (connection.state === signalR.HubConnectionState.Connected) {
                    clearInterval(checkConnection);
                    resolve(connection);
                } else if (connection.state === signalR.HubConnectionState.Disconnected) {
                    clearInterval(checkConnection);
                    // Try starting again
                    connection.start()
                        .then(() => {
                            isConnected = true;
                            console.log('[SignalR] Connected');
                            if (connectionCallbacks.onOpen) {
                                connectionCallbacks.onOpen(connection.connectionId);
                            }
                            resolve(connection);
                        })
                        .catch(reject);
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkConnection);
                reject(new Error('Connection timeout'));
            }, 10000);
        });
    }

    // Only start if disconnected
    if (connection.state === signalR.HubConnectionState.Disconnected) {
        try {
            await connection.start();
            isConnected = true;
            console.log('[SignalR] Connected');
            if (connectionCallbacks.onOpen) {
                connectionCallbacks.onOpen(connection.connectionId);
            }
            return connection;
        } catch (err) {
            console.error('[SignalR] Connection error:', err);
            if (connectionCallbacks.onError) {
                connectionCallbacks.onError(err);
            }
            throw err;
        }
    }

    // If in any other state (Disconnecting), wait and retry
    return new Promise((resolve, reject) => {
        const waitForDisconnect = setInterval(() => {
            if (connection.state === signalR.HubConnectionState.Disconnected) {
                clearInterval(waitForDisconnect);
                startConnection().then(resolve).catch(reject);
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(waitForDisconnect);
            reject(new Error('Connection state timeout'));
        }, 5000);
    });
}

export async function stopConnection() {
    if (connection) {
        await connection.stop();
        isConnected = false;
        currentSessionCode = null;
    }
}

export async function hostSession(mode = 'board') {
    await startConnection();
    const code = await connection.invoke("HostSession", mode);
    currentSessionCode = code;
    return code;
}

export async function joinSession(code, peerId, name = 'Guest') {
    await startConnection();
    const success = await connection.invoke("JoinSession", code, peerId, name);
    if (success) {
        currentSessionCode = code;
    }
    return success;
}

export async function sendDrawingAction(action) {
    if (!isConnected || !currentSessionCode) return;
    await connection.invoke("SendDrawingAction", currentSessionCode, action);
}

export async function sendChatMessage(message, name = null) {
    if (!isConnected || !currentSessionCode) return;
    await connection.invoke("SendChatMessage", currentSessionCode, message, name);
}

export async function updateCursorPosition(x, y) {
    if (!isConnected || !currentSessionCode) return;
    await connection.invoke("UpdateCursorPosition", currentSessionCode, x, y);
}

export async function sendStateUpdate(state) {
    if (!isConnected || !currentSessionCode) return;
    await connection.invoke("SendStateUpdate", currentSessionCode, state);
}

export function setCallbacks(callbacks) {
    connectionCallbacks = { ...connectionCallbacks, ...callbacks };
}

export function getConnectionId() {
    return connection?.connectionId || null;
}

export function isConnectionActive() {
    return isConnected && connection?.state === signalR.HubConnectionState.Connected;
}

function generatePeerId() {
    // Generate a random peer ID for this client
    return 'peer_' + Math.random().toString(36).substr(2, 9);
}

// Export for use in other modules
export { connection };
