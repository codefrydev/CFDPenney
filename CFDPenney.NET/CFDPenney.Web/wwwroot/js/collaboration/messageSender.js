// Message Sending to Peers via SignalR
import { state } from '../state.js';
import { sendDrawingAction, sendChatMessage as signalrSendChat, isConnectionActive } from './signalrClient.js';

// Send message to all connected peers via SignalR
export function sendToAllPeers(message) {
    if (!state.isCollaborating || !isConnectionActive()) {
        return 0;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    // Route message based on type
    if (message.type === 'draw' || message.type === 'DRAW' || 
        message.type === 'ANNOTATION_START' || message.type === 'ANNOTATION_MOVE' || 
        message.type === 'ANNOTATION_END' || message.type === 'ANNOTATION_SYNC' ||
        message.type === 'ANNOTATION_ELEMENT' || message.type === 'ANNOTATION_CLEAR') {
        // Convert to DrawingAction format for SignalR
        const action = {
            Type: message.type,
            Tool: message.tool || message.Tool || '',
            X: message.x !== undefined ? message.x : (message.X !== undefined ? message.X : 0),
            Y: message.y !== undefined ? message.y : (message.Y !== undefined ? message.Y : 0),
            EndX: message.endX !== undefined ? message.endX : (message.EndX !== undefined ? message.EndX : null),
            EndY: message.endY !== undefined ? message.endY : (message.EndY !== undefined ? message.EndY : null),
            Color: message.color || message.Color || '#000000',
            FillColor: message.fillColor || message.FillColor || null,
            StrokeWidth: message.strokeWidth !== undefined ? message.strokeWidth : (message.StrokeWidth !== undefined ? message.StrokeWidth : 2),
            IsDrawing: message.isDrawing !== undefined ? message.isDrawing : (message.IsDrawing !== undefined ? message.IsDrawing : false),
            Text: message.text || message.Text || null,
            Properties: {
                ...(message.properties || message.Properties || {}),
                // Include all message properties in Properties for compatibility
                id: message.id,
                filled: message.filled,
                element: message.element,
                elements: message.elements,
                // Preserve all other message properties
                ...Object.keys(message).reduce((acc, key) => {
                    if (!['type', 'tool', 'x', 'y', 'endX', 'endY', 'color', 'fillColor', 'strokeWidth', 'isDrawing', 'text', 'properties', 'peerId'].includes(key)) {
                        acc[key] = message[key];
                    }
                    return acc;
                }, {})
            },
            PeerId: message.peerId || state.myPeerId
        };
        
        sendDrawingAction(action).catch(err => {
            console.error('[messageSender] Error sending drawing action:', err);
        });
        return 1; // SignalR broadcasts to all, so count as 1
    } else if (message.type === 'CHAT_MESSAGE' || message.type === 'CHAT_REACTION') {
        // Handle chat messages
        const chatMsg = message.content || message.text || message.message || '';
        signalrSendChat(chatMsg, message.name || null).catch(err => {
            console.error('[messageSender] Error sending chat message:', err);
        });
        return 1;
    } else {
        // For other message types, use state update
        sendDrawingAction({
            Type: message.type,
            Properties: message,
            PeerId: state.myPeerId
        }).catch(err => {
            console.error('[messageSender] Error sending message:', err);
        });
        return 1;
    }
}

// Send message to a specific peer (or all if peerId not provided)
// Note: SignalR broadcasts to all, so peerId is ignored for now
export function sendToPeer(message, peerId = null) {
    if (!state.isCollaborating || !isConnectionActive()) {
        return false;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    // SignalR broadcasts to all peers in the group
    // For now, we'll send to all (peerId is ignored)
    return sendToAllPeers(message) > 0;
}

// Send chat message to all connected peers
export function sendChatMessage(message) {
    if (!state.isCollaborating || !isConnectionActive()) {
        return false;
    }
    
    // Ensure message has required fields
    if (!message.type) {
        message.type = 'CHAT_MESSAGE';
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    // Add timestamp if not present
    if (!message.timestamp) {
        message.timestamp = Date.now();
    }
    
    // Send via SignalR
    const chatContent = message.content || message.text || message.message || '';
    signalrSendChat(chatContent, message.name || null).catch(err => {
        console.error('[messageSender] Error sending chat:', err);
    });
    return true;
}

// Send chat reaction to a message
export function sendChatReaction(messageId, emoji) {
    if (!state.isCollaborating) {
        return false;
    }
    
    const message = {
        type: 'CHAT_REACTION',
        messageId: messageId,
        emoji: emoji,
        timestamp: Date.now()
    };
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    // Send to all peers
    return sendToAllPeers(message) > 0;
}

// Alias for sendToAllPeers for backward compatibility
export function sendMessage(message) {
    return sendToAllPeers(message);
}
