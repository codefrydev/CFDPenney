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
    console.log('[shapeHandlers] handleShapeStart - tool:', state.tool, 'x:', x, 'y:', y);
    console.log('[shapeHandlers] handleShapeStart - state.elements.length before:', state.elements.length, 'historyStep:', state.historyStep);
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
    
    console.log('[shapeHandlers] handleShapeStart - newElement:', newElement);
    
    // Slice history for redo path
    state.elements = state.elements.slice(0, state.historyStep + 1);
    state.elements.push(newElement);
    state.historyStep++;
    console.log('[shapeHandlers] handleShapeStart - state.elements.length after:', state.elements.length, 'historyStep:', state.historyStep);
    
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
        console.log('[shapeHandlers] handleShapeMove - no current element at historyStep:', state.historyStep);
        return;
    }
    
    console.log('[shapeHandlers] handleShapeMove - updating element:', currentElement.id, 'end to:', { x, y });
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
    console.log('[shapeHandlers] handleShapeEnd - currentElement:', currentElement ? currentElement.id : 'null');
    if (currentElement) {
        currentElement.isActive = false;
        console.log('[shapeHandlers] handleShapeEnd - final element:', currentElement);
        
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

