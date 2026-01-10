// Message Processing and Canvas State Updates
import { state } from '../state.js';
import { redrawCanvas as regularRedrawCanvas, denormalizeCoordinates as regularDenormalizeCoordinates } from '../canvas.js';
import { denormalizeElement } from './coordinateUtils.js';
import { sendToPeer } from './messageSender.js';
import { handleChatMessage, handleChatReaction } from './chat.js';

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

// Convert SignalR DrawingAction format to internal message format
function normalizeMessage(message) {
    // If message already has lowercase properties, it's already normalized
    if (message.type && !message.Type) {
        return message;
    }
    
    // Convert from SignalR DrawingAction format (PascalCase) to internal format (camelCase)
    const props = message.Properties || message.properties || {};
    const normalized = {
        type: message.Type || message.type || '',
        tool: message.Tool || message.tool || props.tool || '',
        x: message.X !== undefined ? message.X : (message.x !== undefined ? message.x : (props.x !== undefined ? props.x : 0)),
        y: message.Y !== undefined ? message.Y : (message.y !== undefined ? message.y : (props.y !== undefined ? props.y : 0)),
        endX: message.EndX !== undefined ? message.EndX : (message.endX !== undefined ? message.endX : (props.endX !== undefined ? props.endX : null)),
        endY: message.EndY !== undefined ? message.EndY : (message.endY !== undefined ? message.endY : (props.endY !== undefined ? props.endY : null)),
        color: message.Color || message.color || props.color || '#000000',
        fillColor: message.FillColor || message.fillColor || props.fillColor || null,
        strokeWidth: message.StrokeWidth !== undefined ? message.StrokeWidth : (message.strokeWidth !== undefined ? message.strokeWidth : (props.strokeWidth !== undefined ? props.strokeWidth : 2)),
        width: message.StrokeWidth !== undefined ? message.StrokeWidth : (message.width !== undefined ? message.width : (props.width !== undefined ? props.width : (message.strokeWidth !== undefined ? message.strokeWidth : (props.strokeWidth !== undefined ? props.strokeWidth : 2)))),
        isDrawing: message.IsDrawing !== undefined ? message.IsDrawing : (message.isDrawing !== undefined ? message.isDrawing : (props.isDrawing !== undefined ? props.isDrawing : false)),
        text: message.Text || message.text || props.text || null,
        properties: props,
        peerId: message.PeerId || message.peerId || props.peerId || 'unknown',
        id: message.Id || message.id || props.id || null,
        filled: message.Filled !== undefined ? message.Filled : (message.filled !== undefined ? message.filled : (props.filled !== undefined ? props.filled : false)),
        sides: message.Sides || message.sides || props.sides,
        radius: message.Radius !== undefined ? message.Radius : (message.radius !== undefined ? message.radius : (props.radius !== undefined ? props.radius : undefined)),
        element: message.Element || message.element || props.element,
        elements: message.Elements || message.elements || props.elements,
        historyStep: message.HistoryStep !== undefined ? message.HistoryStep : (message.historyStep !== undefined ? message.historyStep : (props.historyStep !== undefined ? props.historyStep : undefined)),
        timestamp: message.Timestamp || message.timestamp || props.timestamp || Date.now()
    };
    
    // Copy any additional properties
    Object.keys(message).forEach(key => {
        if (!normalized.hasOwnProperty(key.toLowerCase()) && !normalized.hasOwnProperty(key)) {
            normalized[key] = message[key];
        }
    });
    
    return normalized;
}

export function handlePeerMessage(message, peerId) {
    // Normalize message format (handle both SignalR and legacy formats)
    const normalizedMsg = normalizeMessage(message);
    const senderPeerId = normalizedMsg.peerId || peerId || 'unknown';
    
    // SignalR handles broadcasting automatically, so no need to rebroadcast
    
    switch (normalizedMsg.type) {
        case 'ANNOTATION_START':
        case 'draw':
            // Peer started drawing - denormalize coordinates
            const denormStart = getDenormalizeCoordinates()(normalizedMsg.x, normalizedMsg.y);
            const newPeerElement = {
                id: normalizedMsg.id || `peer-${Date.now()}-${Math.random()}`,
                type: normalizedMsg.tool,
                color: normalizedMsg.color,
                fillColor: normalizedMsg.fillColor || normalizedMsg.color,
                filled: normalizedMsg.filled || false,
                width: normalizedMsg.width,
                points: [{ x: denormStart.x, y: denormStart.y }],
                start: { x: denormStart.x, y: denormStart.y },
                end: { x: denormStart.x, y: denormStart.y },
                isPeer: true,
                isActive: normalizedMsg.isDrawing !== false, // Mark as active drawing
                peerId: senderPeerId // Track which peer created this
            };
            // Add shape-specific properties
            if (normalizedMsg.sides) newPeerElement.sides = normalizedMsg.sides;
            if (normalizedMsg.radius !== undefined) newPeerElement.radius = normalizedMsg.radius;
            state.peerElements.push(newPeerElement);
            getRedrawCanvas()();
            break;
        case 'ANNOTATION_MOVE':
            // Peer moved while drawing - denormalize coordinates and find the active element
            const denormMove = getDenormalizeCoordinates()(normalizedMsg.x, normalizedMsg.y);
            let activePeerEl = null;
            if (normalizedMsg.id) {
                // Try to find by ID first
                activePeerEl = state.peerElements.find(el => el.id === normalizedMsg.id && el.isPeer);
            }
            // Fallback to last active element if ID not found
            if (!activePeerEl) {
                // Find last element that matches the tool type and is active
                for (let i = state.peerElements.length - 1; i >= 0; i--) {
                    const el = state.peerElements[i];
                    if (el.isPeer && el.isActive && el.type === normalizedMsg.tool) {
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
                if (normalizedMsg.tool === 'pencil' || normalizedMsg.tool === 'eraser') {
                    activePeerEl.points.push({ x: denormMove.x, y: denormMove.y });
                } else {
                    activePeerEl.end = { x: denormMove.x, y: denormMove.y };
                }
                getRedrawCanvas()();
            } else {
                // Create new element as fallback
                state.peerElements.push({
                    id: normalizedMsg.id || `peer-${Date.now()}-${Math.random()}`,
                    type: normalizedMsg.tool,
                    color: normalizedMsg.color || state.color,
                    width: normalizedMsg.width || state.strokeWidth,
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
            if (normalizedMsg.id) {
                const element = state.peerElements.find(el => el.id === normalizedMsg.id && el.isPeer);
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
            if (normalizedMsg.element) {
                const denormalizedElement = denormalizeElement(normalizedMsg.element);
                state.peerElements.push({
                    ...denormalizedElement,
                    isPeer: true,
                    peerId: senderPeerId
                });
                getRedrawCanvas()();
            }
            break;
        case 'ELEMENT_UPDATE':
            // Peer updated an element (move, resize, rotate)
            const peerElement = state.peerElements.find(el => el.id === normalizedMsg.id && el.isPeer);
            if (peerElement && normalizedMsg.element) {
                const denormFunc = getDenormalizeCoordinates();
                if (normalizedMsg.element.start) {
                    const denormStart = denormFunc(normalizedMsg.element.start.x, normalizedMsg.element.start.y);
                    peerElement.start = denormStart;
                }
                if (normalizedMsg.element.end) {
                    const denormEnd = denormFunc(normalizedMsg.element.end.x, normalizedMsg.element.end.y);
                    peerElement.end = denormEnd;
                }
                if (normalizedMsg.element.points) {
                    peerElement.points = normalizedMsg.element.points.map(p => denormFunc(p.x, p.y));
                }
                if (normalizedMsg.element.rotation !== undefined) {
                    peerElement.rotation = normalizedMsg.element.rotation;
                }
                getRedrawCanvas()();
            }
            break;
        case 'ELEMENT_DELETE':
            // Peer deleted an element
            const index = state.peerElements.findIndex(el => el.id === normalizedMsg.id && el.isPeer);
            if (index >= 0) {
                state.peerElements.splice(index, 1);
                getRedrawCanvas()();
            }
            break;
        case 'ANNOTATION_CLEAR':
        case 'clear':
            // Peer cleared canvas
            state.peerElements = [];
            getRedrawCanvas()();
            break;
        case 'ANNOTATION_SYNC':
            // Full state sync - denormalize all element coordinates
            // Mark all synced elements as not active (they're complete)
            const syncedElements = (normalizedMsg.elements || []).map(el => {
                const denormEl = denormalizeElement(el);
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
            // Handle chat message (SignalR sends this separately, but handle for compatibility)
            if (window.handleChatMessage) {
                window.handleChatMessage(normalizedMsg, senderPeerId);
            }
            break;
        case 'CHAT_REACTION':
            // Handle chat reaction
            if (window.handleChatReaction) {
                window.handleChatReaction(normalizedMsg);
            }
            break;
        case 'CHAT_FILE':
            // Handle file attachment (same as CHAT_MESSAGE but for backwards compatibility)
            if (window.handleChatMessage) {
                window.handleChatMessage(normalizedMsg, senderPeerId);
            }
            break;
    }
}

