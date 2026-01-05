// Selection Manipulation
// Provides resize, rotate, move, and delete operations
import { state } from '../state.js';
import { getBoundingBox, getCenter } from '../shapes/shapeUtils.js';
import { redrawCanvas, normalizeCoordinates } from '../canvas.js';
import { sendToAllPeers } from '../collaboration.js';
import { getHandleAtPoint } from './selectionUI.js';
import { getSelectedElement, clearSelection } from './selectionCore.js';
import { isGroup, getGroupChildren, updateGroupBounds } from './grouping.js';

let dragStart = null;
let dragStartElement = null;

/**
 * Start moving selected element
 */
export function startMove(point) {
    const element = getSelectedElement();
    if (!element) return false;
    
    // Set isDrawing flag so moveElement knows we're dragging
    state.isDrawing = true;
    
    dragStart = point;
    dragStartElement = {
        start: { ...element.start },
        end: { ...element.end }
    };
    return true;
}

/**
 * Move selected element
 */
export function moveElement(point) {
    if (!dragStart || !dragStartElement) return;
    
    const element = getSelectedElement();
    if (!element) return;
    
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;
    
    // Handle groups
    if (isGroup(element)) {
        element.start = {
            x: dragStartElement.start.x + dx,
            y: dragStartElement.start.y + dy
        };
        element.end = {
            x: dragStartElement.end.x + dx,
            y: dragStartElement.end.y + dy
        };
    } else {
        element.start = {
            x: dragStartElement.start.x + dx,
            y: dragStartElement.start.y + dy
        };
        element.end = {
            x: dragStartElement.end.x + dx,
            y: dragStartElement.end.y + dy
        };
        
        // Update points for pencil/eraser
        if (element.points && element.points.length > 0) {
            element.points = element.points.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        }
    }
    
    redrawCanvas();
}

/**
 * End move operation
 */
export function endMove() {
    const element = getSelectedElement();
    if (dragStart && element && state.isCollaborating) {
        // Send update to peers
        sendToAllPeers({
            type: 'ELEMENT_UPDATE',
            id: element.id,
            element: {
                start: normalizeCoordinates(element.start.x, element.start.y),
                end: normalizeCoordinates(element.end.x, element.end.y),
                points: element.points ? element.points.map(p => normalizeCoordinates(p.x, p.y)) : null
            }
        });
    }
    
    state.isDrawing = false;
    dragStart = null;
    dragStartElement = null;
}

/**
 * Start resize operation
 */
export function startResize(point, handle) {
    const element = getSelectedElement();
    if (!element || !handle) return false;
    
    state.isResizing = true;
    state.resizeHandle = handle;
    dragStart = point;
    dragStartElement = {
        start: { ...element.start },
        end: { ...element.end }
    };
    return true;
}

/**
 * Resize selected element
 */
export function resizeElement(point) {
    if (!state.isResizing || !dragStart || !dragStartElement) return;
    
    const element = getSelectedElement();
    if (!element || !state.resizeHandle) return;
    
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;
    
    const handle = state.resizeHandle;
    const bbox = getBoundingBox(dragStartElement.start, dragStartElement.end);
    
    // Calculate new bounds based on handle position
    let newStart = { ...dragStartElement.start };
    let newEnd = { ...dragStartElement.end };
    
    switch (handle.position) {
        case 'top-left':
            newStart.x = dragStartElement.start.x + dx;
            newStart.y = dragStartElement.start.y + dy;
            break;
        case 'top-right':
            newEnd.x = dragStartElement.end.x + dx;
            newStart.y = dragStartElement.start.y + dy;
            break;
        case 'bottom-left':
            newStart.x = dragStartElement.start.x + dx;
            newEnd.y = dragStartElement.end.y + dy;
            break;
        case 'bottom-right':
            newEnd.x = dragStartElement.end.x + dx;
            newEnd.y = dragStartElement.end.y + dy;
            break;
        case 'top-center':
            newStart.y = dragStartElement.start.y + dy;
            break;
        case 'bottom-center':
            newEnd.y = dragStartElement.end.y + dy;
            break;
        case 'left-center':
            newStart.x = dragStartElement.start.x + dx;
            break;
        case 'right-center':
            newEnd.x = dragStartElement.end.x + dx;
            break;
    }
    
    element.start = newStart;
    element.end = newEnd;
    
    redrawCanvas();
}

/**
 * End resize operation
 */
export function endResize() {
    const element = getSelectedElement();
    if (state.isResizing && element && state.isCollaborating) {
        sendToAllPeers({
            type: 'ELEMENT_UPDATE',
            id: element.id,
            element: {
                start: normalizeCoordinates(element.start.x, element.start.y),
                end: normalizeCoordinates(element.end.x, element.end.y)
            }
        });
    }
    
    state.isResizing = false;
    state.resizeHandle = null;
    dragStart = null;
    dragStartElement = null;
}

/**
 * Start rotation operation
 */
export function startRotate(point) {
    const element = getSelectedElement();
    if (!element) return false;
    
    state.isRotating = true;
    dragStart = point;
    const center = getCenter(element.start, element.end);
    dragStartElement = {
        center: center,
        startAngle: Math.atan2(point.y - center.y, point.x - center.x)
    };
    return true;
}

/**
 * Rotate selected element
 */
export function rotateElement(point) {
    if (!state.isRotating || !dragStart || !dragStartElement) return;
    
    const element = getSelectedElement();
    if (!element) return;
    
    const currentAngle = Math.atan2(
        point.y - dragStartElement.center.y,
        point.x - dragStartElement.center.x
    );
    const angleDelta = currentAngle - dragStartElement.startAngle;
    
    // Store rotation in element
    element.rotation = (element.rotation || 0) + angleDelta;
    
    dragStartElement.startAngle = currentAngle;
    
    redrawCanvas();
}

/**
 * End rotation operation
 */
export function endRotate() {
    const element = getSelectedElement();
    if (state.isRotating && element && state.isCollaborating) {
        sendToAllPeers({
            type: 'ELEMENT_UPDATE',
            id: element.id,
            element: {
                rotation: element.rotation || 0
            }
        });
    }
    
    state.isRotating = false;
    dragStart = null;
    dragStartElement = null;
}

/**
 * Delete selected element
 */
export function deleteElement() {
    const element = getSelectedElement();
    if (!element) return false;
    
    if (state.isCollaborating) {
        sendToAllPeers({
            type: 'ELEMENT_DELETE',
            id: element.id
        });
    }
    
    state.elements.splice(state.selectedElementIndex, 1);
    state.historyStep = Math.min(state.historyStep, state.elements.length - 1);
    clearSelection();
    redrawCanvas();
    return true;
}

/**
 * Nudge element (move by small amount)
 */
export function nudgeElement(direction) {
    const element = getSelectedElement();
    if (!element) return false;
    
    const nudgeAmount = 5; // pixels
    let dx = 0, dy = 0;
    
    switch (direction) {
        case 'up': dy = -nudgeAmount; break;
        case 'down': dy = nudgeAmount; break;
        case 'left': dx = -nudgeAmount; break;
        case 'right': dx = nudgeAmount; break;
    }
    
    element.start.x += dx;
    element.start.y += dy;
    element.end.x += dx;
    element.end.y += dy;
    
    if (element.points) {
        element.points = element.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
        }));
    }
    
    redrawCanvas();
    
    if (state.isCollaborating) {
        sendToAllPeers({
            type: 'ELEMENT_UPDATE',
            id: element.id,
            element: {
                start: normalizeCoordinates(element.start.x, element.start.y),
                end: normalizeCoordinates(element.end.x, element.end.y)
            }
        });
    }
    
    return true;
}

