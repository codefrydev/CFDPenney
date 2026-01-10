// Main Collaboration Lifecycle
import { state } from '../state.js';
import { showAlert } from '../popupModal.js';
import { redrawCanvas } from '../canvas.js';
import { updateConnectionStatus } from './connectionStatus.js';
import { removeCodeFromURL } from './urlUtils.js';
import { updateParticipantsPanel } from './participantsPanel.js';
import { 
    initializeSignalR, 
    startConnection, 
    hostSession, 
    joinSession, 
    stopConnection,
    setCallbacks,
    getConnectionId
} from './signalrClient.js';
import { handlePeerMessage } from './messageHandler.js';
import { sendMessage } from './messageSender.js';
import { initializeVideoPeer } from './videoCall.js';

export async function startCollaboration() {
    try {
        // Initialize SignalR
        initializeSignalR();
        
        // Set up SignalR callbacks
        setCallbacks({
            onOpen: (connectionId) => {
                state.myPeerId = connectionId;
                state.isCollaborating = true;
                updateParticipantsPanel();
            },
            onClose: () => {
                state.isCollaborating = false;
                updateConnectionStatus(false);
            },
            onError: (err) => {
                console.error('[SignalR] Error:', err);
                showAlert('Connection error: ' + (err.message || 'Unknown error'));
            },
            onDrawingAction: (action) => {
                // Preserve the original action type (ANNOTATION_START, ANNOTATION_MOVE, etc.)
                handlePeerMessage(action, action.PeerId);
            },
            onChatMessage: (message) => {
                if (window.handleChatMessage) {
                    // Normalize message from SignalR format (PascalCase) to expected format (camelCase)
                    const normalizedMessage = {
                        type: message.Type || message.type || 'CHAT_MESSAGE',
                        content: message.Content || message.content || '',
                        text: message.Content || message.content || message.text || '',
                        peerId: message.PeerId || message.peerId || '',
                        name: message.Name || message.name || 'Guest',
                        timestamp: message.Timestamp ? new Date(message.Timestamp).getTime() : (message.timestamp || Date.now()),
                        messageId: message.MessageId || message.messageId || null,
                        // Extract file data from Data dictionary if present
                        file: message.Data?.file || message.data?.file || message.file || null,
                        fileName: message.Data?.fileName || message.data?.fileName || message.fileName || null,
                        fileType: message.Data?.fileType || message.data?.fileType || message.fileType || null,
                        fileSize: message.Data?.fileSize || message.data?.fileSize || message.fileSize || null,
                        // Preserve any other properties
                        ...Object.keys(message).reduce((acc, key) => {
                            if (!['Type', 'Content', 'PeerId', 'Name', 'Timestamp', 'Data', 'type', 'content', 'peerId', 'name', 'timestamp', 'data'].includes(key)) {
                                acc[key] = message[key];
                            }
                            return acc;
                        }, {})
                    };
                    window.handleChatMessage(normalizedMessage);
                }
            },
            onCursorUpdate: (data) => {
                // Handle cursor updates
                if (window.updateRemoteCursor) {
                    window.updateRemoteCursor(data);
                }
            },
            onStateUpdate: (stateData) => {
                // Handle state updates
                if (window.handleStateUpdate) {
                    window.handleStateUpdate(stateData);
                }
            },
            onParticipantJoined: (participant) => {
                // Add participant to state
                if (participant && participant.PeerId && !state.connectedPeers.has(participant.PeerId)) {
                    state.connectedPeers.set(participant.PeerId, {
                        peerId: participant.PeerId,
                        name: participant.Name || 'Guest',
                        color: participant.Color || '#3B82F6',
                        connectedAt: Date.now()
                    });
                    updateParticipantsPanel();
                }
            },
            onParticipantLeft: (data) => {
                // Remove participant from state
                if (data && data.PeerId) {
                    state.connectedPeers.delete(data.PeerId);
                    updateParticipantsPanel();
                }
            },
            onSessionJoined: (data) => {
                // Session joined successfully
                state.isCollaborating = true;
                state.shareCode = data.Code;
                state.mode = data.Mode || 'board';
                
                // Add existing participants
                if (data.Participants && Array.isArray(data.Participants)) {
                    data.Participants.forEach(p => {
                        if (p && p.PeerId && p.PeerId !== state.myPeerId) {
                            state.connectedPeers.set(p.PeerId, {
                                peerId: p.PeerId,
                                name: p.Name || 'Guest',
                                color: p.Color || '#3B82F6',
                                connectedAt: Date.now()
                            });
                        }
                    });
                }
                
                updateConnectionStatus(true, data.Code);
                updateParticipantsPanel();
            }
        });

        // Start connection and host session
        await startConnection();
        const shareCode = await hostSession(state.mode || 'board');

        state.isHosting = true;
        state.shareCode = shareCode;
        state.isCollaborating = true;
        updateConnectionStatus(true, shareCode);

        updateParticipantsPanel();

    } catch (err) {
        console.error('Error starting collaboration:', err);
        showAlert('Failed to start collaboration: ' + err.message);
        state.isHosting = false;
        state.shareCode = null;
        state.isCollaborating = false;
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
        // Initialize SignalR
        initializeSignalR();
        
        // Initialize video peer for WebRTC video/audio (separate from SignalR data)
        initializeVideoPeer();
        
        // Set up SignalR callbacks (same as host)
        setCallbacks({
            onOpen: (connectionId) => {
                state.myPeerId = connectionId;
            },
            onClose: () => {
                state.isCollaborating = false;
                updateConnectionStatus(false);
            },
            onError: (err) => {
                console.error('[SignalR] Error:', err);
                if (statusText) {
                    statusText.textContent = 'Connection failed';
                }
                showAlert('Connection error: ' + (err.message || 'Unknown error'));
                stopCollaboration();
            },
            onDrawingAction: (action) => {
                // Preserve the original action type (ANNOTATION_START, ANNOTATION_MOVE, etc.)
                handlePeerMessage(action, action.PeerId);
            },
            onChatMessage: (message) => {
                if (window.handleChatMessage) {
                    // Normalize message from SignalR format (PascalCase) to expected format (camelCase)
                    const normalizedMessage = {
                        type: message.Type || message.type || 'CHAT_MESSAGE',
                        content: message.Content || message.content || '',
                        text: message.Content || message.content || message.text || '',
                        peerId: message.PeerId || message.peerId || '',
                        name: message.Name || message.name || 'Guest',
                        timestamp: message.Timestamp ? new Date(message.Timestamp).getTime() : (message.timestamp || Date.now()),
                        messageId: message.MessageId || message.messageId || null,
                        // Extract file data from Data dictionary if present
                        file: message.Data?.file || message.data?.file || message.file || null,
                        fileName: message.Data?.fileName || message.data?.fileName || message.fileName || null,
                        fileType: message.Data?.fileType || message.data?.fileType || message.fileType || null,
                        fileSize: message.Data?.fileSize || message.data?.fileSize || message.fileSize || null,
                        // Preserve any other properties
                        ...Object.keys(message).reduce((acc, key) => {
                            if (!['Type', 'Content', 'PeerId', 'Name', 'Timestamp', 'Data', 'type', 'content', 'peerId', 'name', 'timestamp', 'data'].includes(key)) {
                                acc[key] = message[key];
                            }
                            return acc;
                        }, {})
                    };
                    window.handleChatMessage(normalizedMessage);
                }
            },
            onCursorUpdate: (data) => {
                if (window.updateRemoteCursor) {
                    window.updateRemoteCursor(data);
                }
            },
            onStateUpdate: (stateData) => {
                if (window.handleStateUpdate) {
                    window.handleStateUpdate(stateData);
                }
            },
            onParticipantJoined: (participant) => {
                if (!state.connectedPeers.has(participant.PeerId)) {
                    state.connectedPeers.set(participant.PeerId, {
                        peerId: participant.PeerId,
                        name: participant.Name,
                        color: participant.Color,
                        connectedAt: Date.now()
                    });
                    updateParticipantsPanel();
                }
            },
            onParticipantLeft: (data) => {
                state.connectedPeers.delete(data.PeerId);
                updateParticipantsPanel();
            },
            onSessionJoined: (data) => {
                state.isCollaborating = true;
                state.shareCode = data.Code;
                state.mode = data.Mode || 'board';
                
                if (data.Participants && Array.isArray(data.Participants)) {
                    data.Participants.forEach(p => {
                        if (p && p.PeerId && p.PeerId !== state.myPeerId) {
                            state.connectedPeers.set(p.PeerId, {
                                peerId: p.PeerId,
                                name: p.Name || 'Guest',
                                color: p.Color || '#3B82F6',
                                connectedAt: Date.now()
                            });
                        }
                    });
                }
                
                // Load chat history from server (all messages are server-side)
                if (data.ChatHistory && Array.isArray(data.ChatHistory)) {
                    state.chatMessages = [];
                    data.ChatHistory.forEach(msg => {
                        if (window.handleChatMessage) {
                            const normalizedMessage = {
                                type: msg.Type || msg.type || 'CHAT_MESSAGE',
                                content: msg.Content || msg.content || '',
                                text: msg.Content || msg.content || msg.text || '',
                                peerId: msg.PeerId || msg.peerId || '',
                                name: msg.Name || msg.name || 'Guest',
                                timestamp: msg.Timestamp ? new Date(msg.Timestamp).getTime() : (msg.timestamp || Date.now()),
                                messageId: msg.MessageId || msg.messageId || null,
                                file: msg.Data?.file || msg.data?.file || msg.file || null,
                                fileName: msg.Data?.fileName || msg.data?.fileName || msg.fileName || null,
                                fileType: msg.Data?.fileType || msg.data?.fileType || msg.fileType || null,
                                fileSize: msg.Data?.fileSize || msg.data?.fileSize || msg.fileSize || null
                            };
                            window.handleChatMessage(normalizedMessage);
                        }
                    });
                }
                
                updateConnectionStatus(true, data.Code);
                updateParticipantsPanel();
                
                if (statusText) {
                    statusText.textContent = 'Connected';
                }
            }
        });

        // Start connection and join session
        await startConnection();
        const peerId = 'peer_' + Math.random().toString(36).substr(2, 9);
        const success = await joinSession(code, peerId, 'Guest');
        
        if (!success) {
            if (statusText) {
                statusText.textContent = 'Host not found';
            }
            showAlert('Could not connect to host. Please check:\n\n1. The share code is correct\n2. The host is still online\n3. Try again in a moment');
            stopCollaboration();
            return;
        }

    } catch (err) {
        console.error('Error joining collaboration:', err);
        showAlert('Failed to join: ' + err.message);
        stopCollaboration();
    }
}

export async function stopCollaboration() {
    // Stop SignalR connection
    await stopConnection();
    
    // Close all calls (screen share) - keep for WebRTC video
    state.calls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.calls.clear();
    
    // Close all camera calls - keep for WebRTC video
    state.cameraCalls.forEach((call, peerId) => {
        if (call) {
            call.close();
        }
    });
    state.cameraCalls.clear();
    
    // Clear peer tracking
    state.connectedPeers.clear();
    state.dataConnections.clear();
    
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

