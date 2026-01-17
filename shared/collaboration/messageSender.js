// Message Sending to Peers
// Shared module for sending messages to connected peers

/**
 * Send message to all connected peers
 * @param {Object} state - The application state
 * @param {Object} message - The message to send
 * @returns {number} Number of peers message was sent to
 */
export function sendToAllPeers(state, message) {
    if (!state.isCollaborating) {
        return 0;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    let sentCount = 0;
    state.dataConnections.forEach((conn, peerId) => {
        if (conn && conn.open) {
            try {
                const messageStr = JSON.stringify(message);
                conn.send(messageStr);
                sentCount++;
            } catch (err) {
                console.error(`[messageSender] Error sending to peer ${peerId}:`, err);
            }
        }
    });
    return sentCount;
}

/**
 * Send message to a specific peer (or all if peerId not provided)
 * @param {Object} state - The application state
 * @param {Object} message - The message to send
 * @param {string|null} peerId - The peer ID to send to (null for broadcast)
 * @returns {boolean} Whether the message was sent successfully
 */
export function sendToPeer(state, message, peerId = null) {
    if (!state.isCollaborating) {
        return false;
    }
    
    // Add our peer ID to the message for identification
    if (state.myPeerId && !message.peerId) {
        message.peerId = state.myPeerId;
    }
    
    if (peerId) {
        // Send to specific peer
        const conn = state.dataConnections.get(peerId);
        if (conn && conn.open) {
            try {
                const messageStr = JSON.stringify(message);
                conn.send(messageStr);
                return true;
            } catch (err) {
                console.error(`sendToPeer: Error sending to peer ${peerId}:`, err);
                return false;
            }
        }
        return false;
    } else {
        // If no peerId specified, broadcast to all (for backward compatibility)
        return sendToAllPeers(state, message) > 0;
    }
}

/**
 * Send chat message to all connected peers
 * @param {Object} state - The application state
 * @param {Object} message - The chat message to send
 * @returns {boolean} Whether the message was sent successfully
 */
export function sendChatMessage(state, message) {
    if (!state.isCollaborating) {
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
    
    // Send to all peers
    return sendToAllPeers(state, message) > 0;
}

/**
 * Send chat reaction to a message
 * @param {Object} state - The application state
 * @param {string} messageId - The message ID to react to
 * @param {string} emoji - The emoji reaction
 * @returns {boolean} Whether the reaction was sent successfully
 */
export function sendChatReaction(state, messageId, emoji) {
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
    return sendToAllPeers(state, message) > 0;
}
