// Shape Tool Event Handlers
// Handles drawing events for shape tools
import { state } from '../state.js';
import { getBoundingBox, getCenter, getCircleRadius } from './shapeUtils.js';
import { redrawCanvas, normalizeCoordinates } from '../canvas.js';
import { sendToAllPeers } from '../collaboration.js';

/**
 * Handle shape tool start event
 */
export function handleShapeStart(x, y) {
    const elementId = `local-${Date.now()}-${Math.random()}`;
    const newElement = {
        id: elementId,
        type: state.tool,
        color: state.color,
        fillColor: state.fillColor,
        filled: state.filled,
        width: state.strokeWidth,
        start: { x, y },
        end: { x, y },
        isActive: true
    };
    
    // Add shape-specific properties
    if (state.tool === 'circle' || state.tool === 'ellipse') {
        newElement.radius = 0;
    }
    
    if (['pentagon', 'hexagon', 'octagon'].includes(state.tool)) {
        const sidesMap = { pentagon: 5, hexagon: 6, octagon: 8 };
        newElement.sides = sidesMap[state.tool];
    }
    
    // Slice history for redo path
    state.elements = state.elements.slice(0, state.historyStep + 1);
    state.elements.push(newElement);
    state.historyStep++;
    
    // Send to all peers
    if (state.isCollaborating) {
        const normalized = normalizeCoordinates(x, y);
        sendToAllPeers({
            type: 'ANNOTATION_START',
            id: elementId,
            tool: state.tool,
            color: newElement.color,
            fillColor: newElement.fillColor,
            filled: newElement.filled,
            width: newElement.width,
            sides: newElement.sides,
            radius: newElement.radius,
            x: normalized.x,
            y: normalized.y
        });
    }
    
    redrawCanvas();
}

/**
 * Handle shape tool move event
 */
export function handleShapeMove(x, y) {
    const currentElement = state.elements[state.historyStep];
    if (!currentElement) {
        return;
    }
    
    currentElement.end = { x, y };
    
    // Update shape-specific properties
    if (currentElement.type === 'circle' || currentElement.type === 'ellipse') {
        currentElement.radius = getCircleRadius(currentElement.start, currentElement.end);
    }
    
    // Send to all peers
    if (state.isCollaborating) {
        const normalized = normalizeCoordinates(x, y);
        sendToAllPeers({
            type: 'ANNOTATION_MOVE',
            id: currentElement.id,
            tool: currentElement.type,
            x: normalized.x,
            y: normalized.y
        });
    }
    
    redrawCanvas();
}

/**
 * Handle shape tool end event
 */
export function handleShapeEnd() {
    const currentElement = state.elements[state.historyStep];
    if (currentElement) {
        currentElement.isActive = false;
        
        if (state.isCollaborating) {
            sendToAllPeers({
                type: 'ANNOTATION_END',
                id: currentElement.id
            });
        }
    }
}

/**
 * Check if current tool is a shape tool
 */
export function isShapeTool(tool) {
    const shapeTools = ['line', 'arrow', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'octagon'];
    return shapeTools.includes(tool);
}

