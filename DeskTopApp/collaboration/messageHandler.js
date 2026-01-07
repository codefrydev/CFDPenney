// Message Processing and Overlay State Updates (Adapted for Electron)
import { state, getPeerColor } from '../state.js';
import { denormalizeCoordinates } from './coordinateUtils.js';

// Canvas dimensions (will be set from overlay)
let canvasWidth = 1920;
let canvasHeight = 1080;

export function setCanvasDimensions(width, height) {
    canvasWidth = width;
    canvasHeight = height;
}

export function handlePeerMessage(message, peerId) {
    const senderPeerId = message.peerId || peerId || 'unknown';
    
    // Forward to screen.js handler for overlay updates
    if (typeof window.handlePeerOverlayEvent === 'function') {
        window.handlePeerOverlayEvent(message);
    } else {
    }
    
    // If we're the host, rebroadcast this message to all other peers (except the sender)
    if (state.isHosting && senderPeerId !== state.myPeerId) {
        // Import sendToAllPeers dynamically to avoid circular dependency
        import('./messageSender.js').then(({ sendToAllPeers }) => {
            state.dataConnections.forEach((conn, targetPeerId) => {
                // Don't send back to the original sender
                if (targetPeerId !== senderPeerId && conn && conn.open) {
                    try {
                        // Preserve the original peerId so recipients know who sent it
                        const rebroadcastMessage = { ...message, peerId: senderPeerId };
                        conn.send(JSON.stringify(rebroadcastMessage));
                    } catch (err) {
                        console.error(`Error rebroadcasting to peer ${targetPeerId}:`, err);
                    }
                }
            });
        });
    }
    
    switch (message.type) {
        case 'POINTER_MOVE':
            // Update pointer position for this peer
            const denormPointer = denormalizeCoordinates(message.nx, message.ny, canvasWidth, canvasHeight);
            state.pointers.set(senderPeerId, {
                x: denormPointer.x,
                y: denormPointer.y,
                color: getPeerColor(senderPeerId),
                timestamp: Date.now()
            });
            
            // Forward to overlay via IPC if available
            if (window.electronAPI) {
                window.electronAPI.sendPointerMove({
                    peerId: senderPeerId,
                    x: denormPointer.x,
                    y: denormPointer.y,
                    color: getPeerColor(senderPeerId)
                });
            }
            break;
            
        case 'STROKE_START':
            const denormStart = denormalizeCoordinates(message.nx, message.ny, canvasWidth, canvasHeight);
            const strokeId = message.id || `stroke-${senderPeerId}-${Date.now()}`;
            
            state.strokes.set(strokeId, {
                id: strokeId,
                peerId: senderPeerId,
                tool: message.tool || 'pencil',
                color: message.color || getPeerColor(senderPeerId),
                width: message.width || 4,
                points: [{ x: denormStart.x, y: denormStart.y }],
                isActive: true
            });
            
            state.activeStrokes.set(senderPeerId, strokeId);
            
            // Forward to overlay via IPC if available
            if (window.electronAPI) {
                window.electronAPI.sendStrokeStart({
                    id: strokeId,
                    peerId: senderPeerId,
                    tool: message.tool,
                    color: message.color || getPeerColor(senderPeerId),
                    width: message.width,
                    x: denormStart.x,
                    y: denormStart.y
                });
            }
            break;
            
        case 'STROKE_MOVE':
            const activeStrokeId = message.id || state.activeStrokes.get(senderPeerId);
            if (activeStrokeId && state.strokes.has(activeStrokeId)) {
                const stroke = state.strokes.get(activeStrokeId);
                const denormMove = denormalizeCoordinates(message.nx, message.ny, canvasWidth, canvasHeight);
                stroke.points.push({ x: denormMove.x, y: denormMove.y });
                
                // Forward to overlay via IPC if available
                if (window.electronAPI) {
                    window.electronAPI.sendStrokeMove({
                        id: activeStrokeId,
                        peerId: senderPeerId,
                        x: denormMove.x,
                        y: denormMove.y
                    });
                }
            }
            break;
            
        case 'STROKE_END':
            const endStrokeId = message.id || state.activeStrokes.get(senderPeerId);
            if (endStrokeId && state.strokes.has(endStrokeId)) {
                const stroke = state.strokes.get(endStrokeId);
                stroke.isActive = false;
                state.activeStrokes.delete(senderPeerId);
                
                // Forward to overlay via IPC if available
                if (window.electronAPI) {
                    window.electronAPI.sendStrokeEnd({
                        id: endStrokeId,
                        peerId: senderPeerId
                    });
                }
            }
            break;
            
        case 'CLEAR_OVERLAY':
            // Clear all strokes
            state.strokes.clear();
            state.activeStrokes.clear();
            
            // Forward to overlay via IPC if available
            if (window.electronAPI) {
                window.electronAPI.sendClearOverlay();
            }
            break;
            
        case 'CHAT_MESSAGE':
            // Handle chat message
            if (window.handleChatMessage) {
                window.handleChatMessage(message, senderPeerId);
            }
            break;
            
        case 'CHAT_REACTION':
            // Handle chat reaction
            if (window.handleChatReaction) {
                window.handleChatReaction(message);
            }
            break;
    }
}

