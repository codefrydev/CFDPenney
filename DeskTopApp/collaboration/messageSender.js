// Message Sending to Peers (Adapted for Electron)
import { state } from '../state.js';

// Send message to all connected peers
export function sendToAllPeers(message) {
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
                console.error(`Error sending to peer ${peerId}:`, err);
            }
        }
    });
    return sentCount;
}

// Send message to a specific peer (or all if peerId not provided)
export function sendToPeer(message, peerId = null) {
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
        // If no peerId specified, broadcast to all
        return sendToAllPeers(message) > 0;
    }
}

