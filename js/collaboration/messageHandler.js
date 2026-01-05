// Message Processing and Canvas State Updates
import { state } from '../state.js';
import { redrawCanvas, denormalizeCoordinates } from '../canvas.js';
import { denormalizeElement } from './coordinateUtils.js';
import { sendToPeer } from './messageSender.js';

export function handlePeerMessage(message, peerId) {
    const senderPeerId = message.peerId || peerId || 'unknown';
    
    // If we're the host, rebroadcast this message to all other peers (except the sender)
    // This ensures all peers see each other's annotations
    if (state.isHosting && senderPeerId !== state.myPeerId) {
        // Don't rebroadcast SYNC messages (those are one-time initial syncs from host)
        if (message.type !== 'ANNOTATION_SYNC') {
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
        }
    }
    
    switch (message.type) {
        case 'ANNOTATION_START':
            // Peer started drawing - denormalize coordinates
            const denormStart = denormalizeCoordinates(message.x, message.y);
            const newPeerElement = {
                id: message.id || `peer-${Date.now()}-${Math.random()}`,
                type: message.tool,
                color: message.color,
                width: message.width,
                points: [{ x: denormStart.x, y: denormStart.y }],
                start: { x: denormStart.x, y: denormStart.y },
                end: { x: denormStart.x, y: denormStart.y },
                isPeer: true,
                isActive: true, // Mark as active drawing
                peerId: senderPeerId // Track which peer created this
            };
            state.peerElements.push(newPeerElement);
            redrawCanvas();
            break;
        case 'ANNOTATION_MOVE':
            // Peer moved while drawing - denormalize coordinates and find the active element
            const denormMove = denormalizeCoordinates(message.x, message.y);
            let activePeerEl = null;
            if (message.id) {
                // Try to find by ID first
                activePeerEl = state.peerElements.find(el => el.id === message.id && el.isPeer);
            }
            // Fallback to last active element if ID not found
            if (!activePeerEl) {
                // Find last element that matches the tool type and is active
                for (let i = state.peerElements.length - 1; i >= 0; i--) {
                    const el = state.peerElements[i];
                    if (el.isPeer && el.isActive && el.type === message.tool) {
                        activePeerEl = el;
                        break;
                    }
                }
            }
            // Last resort: use the last peer element
            if (!activePeerEl) {
                const lastEl = state.peerElements[state.peerElements.length - 1];
                if (lastEl && lastEl.isPeer) {
                    activePeerEl = lastEl;
                }
            }
            
            if (activePeerEl) {
                if (message.tool === 'pencil' || message.tool === 'eraser') {
                    activePeerEl.points.push({ x: denormMove.x, y: denormMove.y });
                } else {
                    activePeerEl.end = { x: denormMove.x, y: denormMove.y };
                }
                redrawCanvas();
            } else {
                // Create new element as fallback
                state.peerElements.push({
                    id: message.id || `peer-${Date.now()}-${Math.random()}`,
                    type: message.tool,
                    color: state.color, // Use default color if not provided
                    width: state.strokeWidth, // Use default width if not provided
                    points: [{ x: denormMove.x, y: denormMove.y }],
                    start: { x: denormMove.x, y: denormMove.y },
                    end: { x: denormMove.x, y: denormMove.y },
                    isPeer: true,
                    isActive: true,
                    peerId: senderPeerId
                });
                redrawCanvas();
            }
            break;
        case 'ANNOTATION_END':
            // Peer finished drawing - mark active element as inactive
            if (message.id) {
                const element = state.peerElements.find(el => el.id === message.id && el.isPeer);
                if (element) {
                    element.isActive = false;
                }
            } else {
                // Mark last active element as inactive
                for (let i = state.peerElements.length - 1; i >= 0; i--) {
                    const el = state.peerElements[i];
                    if (el.isPeer && el.isActive) {
                        el.isActive = false;
                        break;
                    }
                }
            }
            redrawCanvas();
            break;
        case 'ANNOTATION_ELEMENT':
            // Peer added a complete element (e.g., text) - denormalize coordinates
            const denormalizedElement = denormalizeElement(message.element);
            state.peerElements.push({
                ...denormalizedElement,
                isPeer: true,
                peerId: senderPeerId
            });
            redrawCanvas();
            break;
        case 'ANNOTATION_CLEAR':
            // Peer cleared canvas
            state.peerElements = [];
            redrawCanvas();
            break;
        case 'ANNOTATION_SYNC':
            // Full state sync - denormalize all element coordinates
            // Mark all synced elements as not active (they're complete)
            const syncedElements = (message.elements || []).map(el => {
                const denormEl = denormalizeElement(el);
                return {
                    ...denormEl,
                    isPeer: true,
                    isActive: false,
                    peerId: senderPeerId // Elements from sync are from the host
                };
            });
            state.peerElements = syncedElements;
            redrawCanvas();
            break;
    }
}

