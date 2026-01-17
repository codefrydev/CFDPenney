// Message Processing and Canvas State Updates
import { state } from '../state.js';
import { redrawCanvas as regularRedrawCanvas, denormalizeCoordinates as regularDenormalizeCoordinates } from '../canvas.js';
import { denormalizeElement } from '../../shared/collaboration/coordinateUtils.js';
import { sendToPeer as sharedSendToPeer } from '../../shared/collaboration/messageSender.js';
import { handleChatMessage, handleChatReaction } from './chat.js';
import { webAdapter } from '../../shared/adapters/webAdapter.js';
import { startTrailAnimation } from '../trails.js';

// Wrapper for sendToPeer that includes state
function sendToPeer(message, peerId = null) {
    return sharedSendToPeer(state, message, peerId);
}

// Feature detection: Check if penney canvas functions are available
// This allows us to use penney-specific functions when on penney page, with fallback to regular functions
// penneyMain.js registers penney functions globally at window.penneyCanvasFunctions for synchronous access

// Helper function to check if we're on penney page
function isPenneyPage() {
    if (typeof window === 'undefined') return false;
    // Check for global marker set by penneyMain.js (most reliable)
    if (window.isPenneyPage) {
        return true;
    }
    // Fallback: Check pathname for penney.html
    if (window.location && window.location.pathname.includes('penney.html')) {
        return true;
    }
    return false;
}

// Helper function to get the appropriate redrawCanvas function
function getRedrawCanvas() {
    const isPenney = isPenneyPage();
    const hasPenneyFunctions = window.penneyCanvasFunctions && window.penneyCanvasFunctions.redrawCanvas;
    
    // Check if penney functions are available globally (set by penneyMain.js)
    if (isPenney && hasPenneyFunctions) {
        return window.penneyCanvasFunctions.redrawCanvas;
    }
    // Fallback to regular canvas function
    return regularRedrawCanvas;
}

// Helper function to get the appropriate denormalizeCoordinates function
function getDenormalizeCoordinates() {
    const isPenney = isPenneyPage();
    const hasPenneyFunctions = window.penneyCanvasFunctions && window.penneyCanvasFunctions.denormalizeCoordinates;
    
    // Check if penney functions are available globally (set by penneyMain.js)
    if (isPenney && hasPenneyFunctions) {
        return window.penneyCanvasFunctions.denormalizeCoordinates;
    }
    // Fallback to regular canvas function
    return regularDenormalizeCoordinates;
}

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
            const denormStart = getDenormalizeCoordinates()(message.x, message.y);
            const newPeerElement = {
                id: message.id || `peer-${Date.now()}-${Math.random()}`,
                type: message.tool,
                color: message.color,
                fillColor: message.fillColor || message.color,
                filled: message.filled || false,
                width: message.width,
                points: [{ x: denormStart.x, y: denormStart.y }],
                start: { x: denormStart.x, y: denormStart.y },
                end: { x: denormStart.x, y: denormStart.y },
                isPeer: true,
                isActive: true, // Mark as active drawing
                peerId: senderPeerId // Track which peer created this
            };
            // Add timestamp and type for trail elements
            if (message.tool === 'trail' && message.timestamp) {
                newPeerElement.timestamp = message.timestamp;
                newPeerElement.trailType = message.trailType || 'fade';
                // Start the animation loop for trails
                startTrailAnimation();
            }
            // Add shape-specific properties
            if (message.sides) newPeerElement.sides = message.sides;
            if (message.radius !== undefined) newPeerElement.radius = message.radius;
            state.peerElements.push(newPeerElement);
            getRedrawCanvas()();
            break;
        case 'ANNOTATION_MOVE':
            // Peer moved while drawing - denormalize coordinates and find the active element
            const denormMove = getDenormalizeCoordinates()(message.x, message.y);
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
                if (message.tool === 'pencil' || message.tool === 'eraser' || message.tool === 'trail') {
                    activePeerEl.points.push({ x: denormMove.x, y: denormMove.y });
                } else {
                    activePeerEl.end = { x: denormMove.x, y: denormMove.y };
                }
                getRedrawCanvas()();
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
                getRedrawCanvas()();
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
            getRedrawCanvas()();
            break;
        case 'ANNOTATION_ELEMENT':
            // Peer added a complete element (e.g., text, sticker) - denormalize coordinates
            const denormalizedElement = denormalizeElement(message.element, webAdapter);
            state.peerElements.push({
                ...denormalizedElement,
                isPeer: true,
                peerId: senderPeerId
            });
            getRedrawCanvas()();
            break;
        case 'ELEMENT_UPDATE':
            // Peer updated an element (move, resize, rotate)
            const peerElement = state.peerElements.find(el => el.id === message.id && el.isPeer);
            if (peerElement && message.element) {
                const denormFunc = getDenormalizeCoordinates();
                if (message.element.start) {
                    const denormStart = denormFunc(message.element.start.x, message.element.start.y);
                    peerElement.start = denormStart;
                }
                if (message.element.end) {
                    const denormEnd = denormFunc(message.element.end.x, message.element.end.y);
                    peerElement.end = denormEnd;
                }
                if (message.element.points) {
                    peerElement.points = message.element.points.map(p => denormFunc(p.x, p.y));
                }
                if (message.element.rotation !== undefined) {
                    peerElement.rotation = message.element.rotation;
                }
                getRedrawCanvas()();
            }
            break;
        case 'ELEMENT_DELETE':
            // Peer deleted an element
            const index = state.peerElements.findIndex(el => el.id === message.id && el.isPeer);
            if (index >= 0) {
                state.peerElements.splice(index, 1);
                getRedrawCanvas()();
            }
            break;
        case 'ANNOTATION_CLEAR':
            // Peer cleared canvas
            state.peerElements = [];
            getRedrawCanvas()();
            break;
        case 'ANNOTATION_SYNC':
            // Full state sync - denormalize all element coordinates
            // Mark all synced elements as not active (they're complete)
            const syncedElements = (message.elements || []).map(el => {
                const denormEl = denormalizeElement(el, webAdapter);
                return {
                    ...denormEl,
                    isPeer: true,
                    isActive: false,
                    peerId: senderPeerId // Elements from sync are from the host
                };
            });
            state.peerElements = syncedElements;
            getRedrawCanvas()();
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
        case 'CHAT_FILE':
            // Handle file attachment (same as CHAT_MESSAGE but for backwards compatibility)
            if (window.handleChatMessage) {
                window.handleChatMessage(message, senderPeerId);
            }
            break;
    }
}

