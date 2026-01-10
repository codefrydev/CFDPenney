// Selection Manipulation
// Provides resize, rotate, move, and delete operations
import { state } from '../state.js';
import { getBoundingBox, getCenter } from '../shapes/shapeUtils.js';
import { redrawCanvas, normalizeCoordinates } from '../canvas.js';
import { sendToAllPeers } from '../collaboration.js';
import { getHandleAtPoint } from './selectionUI.js';
import { getSelectedElement, clearSelection, getSelectedElements } from './selectionCore.js';
import { isGroup, getGroupChildren, updateGroupBounds } from './grouping.js';

let dragStart = null;
let dragStartElement = null;
let dragStartElements = null; // For multi-element drag

// Minimum size constraint for resizing
const MIN_SIZE = 10;

/**
 * Calculate scale factors between two bounding boxes
 */
function getScaleFactors(oldBbox, newBbox) {
    const scaleX = oldBbox.width > 0 ? newBbox.width / oldBbox.width : 1;
    const scaleY = oldBbox.height > 0 ? newBbox.height / oldBbox.height : 1;
    return { scaleX, scaleY };
}

/**
 * Scale points array proportionally based on bounding box change
 */
function scalePoints(points, oldBbox, newBbox) {
    if (!points || points.length === 0) return points;
    
    const { scaleX, scaleY } = getScaleFactors(oldBbox, newBbox);
    
    return points.map(point => ({
        x: oldBbox.x + (point.x - oldBbox.x) * scaleX,
        y: oldBbox.y + (point.y - oldBbox.y) * scaleY
    }));
}

/**
 * Scale group children proportionally
 */
function scaleGroupChildren(group, oldBbox, newBbox, originalGroupChildren) {
    if (!group || !group.children || group.children.length === 0) return;
    
    const { scaleX, scaleY } = getScaleFactors(oldBbox, newBbox);
    
    group.children.forEach((child, index) => {
        // Get original relative positions from stored state
        const originalChild = originalGroupChildren && originalGroupChildren[index];
        if (!originalChild) {
            // Fallback: scale current positions
            child.relativeStart.x *= scaleX;
            child.relativeStart.y *= scaleY;
            child.relativeEnd.x *= scaleX;
            child.relativeEnd.y *= scaleY;
            return;
        }
        
        // Calculate original child bounding box in absolute coordinates
        const originalChildAbsStart = {
            x: oldBbox.x + originalChild.relativeStart.x,
            y: oldBbox.y + originalChild.relativeStart.y
        };
        const originalChildAbsEnd = {
            x: oldBbox.x + originalChild.relativeEnd.x,
            y: oldBbox.y + originalChild.relativeEnd.y
        };
        const originalChildBbox = getBoundingBox(originalChildAbsStart, originalChildAbsEnd);
        
        // Scale relative positions
        child.relativeStart.x = originalChild.relativeStart.x * scaleX;
        child.relativeStart.y = originalChild.relativeStart.y * scaleY;
        child.relativeEnd.x = originalChild.relativeEnd.x * scaleX;
        child.relativeEnd.y = originalChild.relativeEnd.y * scaleY;
        
        // Calculate new child bounding box in absolute coordinates
        const newChildAbsStart = {
            x: newBbox.x + child.relativeStart.x,
            y: newBbox.y + child.relativeStart.y
        };
        const newChildAbsEnd = {
            x: newBbox.x + child.relativeEnd.x,
            y: newBbox.y + child.relativeEnd.y
        };
        const newChildBbox = getBoundingBox(newChildAbsStart, newChildAbsEnd);
        
        // Update points array if present
        if (child.element && child.element.points && child.element.points.length > 0 && originalChild.element) {
            // Use original points from stored state
            const originalPoints = originalChild.element.points || child.element.points;
            child.element.points = scalePoints(originalPoints, originalChildBbox, newChildBbox);
        }
    });
}

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
 * Start moving multiple selected elements
 */
export function startMoveMultiple(point) {
    const selectedElements = getSelectedElements();
    if (selectedElements.length === 0) return false;
    
    state.isDrawing = true;
    dragStart = point;
    
    // Store original positions for all selected elements
    dragStartElements = selectedElements.map(({ element }) => ({
        element,
        start: { ...element.start },
        end: { ...element.end },
        points: element.points ? element.points.map(p => ({ ...p })) : null
    }));
    
    return true;
}

/**
 * Move multiple selected elements
 */
export function moveMultipleElements(point) {
    if (!dragStart || !dragStartElements || dragStartElements.length === 0) return;
    
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;
    
    // Update all selected elements
    dragStartElements.forEach(({ element, start, end, points }) => {
        // Update start and end positions
        element.start = {
            x: start.x + dx,
            y: start.y + dy
        };
        element.end = {
            x: end.x + dx,
            y: end.y + dy
        };
        
        // Update points for pencil/eraser
        if (points && points.length > 0) {
            element.points = points.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        }
        
        // Handle groups
        if (isGroup(element)) {
            // Groups are already handled by updating start/end
            // Children positions are relative to group start
        }
    });
    
    redrawCanvas();
}

/**
 * End move operation for multiple elements
 */
export function endMoveMultiple() {
    if (!dragStart || !dragStartElements || dragStartElements.length === 0) {
        state.isDrawing = false;
        dragStart = null;
        dragStartElements = null;
        return;
    }
    
    if (state.isCollaborating) {
        // Send updates for all moved elements
        dragStartElements.forEach(({ element }) => {
            const updateData = {
                start: normalizeCoordinates(element.start.x, element.start.y),
                end: normalizeCoordinates(element.end.x, element.end.y)
            };
            
            // Include points array for pencil/eraser elements
            if (element.points && element.points.length > 0) {
                updateData.points = element.points.map(p => normalizeCoordinates(p.x, p.y));
            }
            
            // Include children for groups
            if (isGroup(element) && element.children) {
                updateData.children = element.children.map(child => ({
                    id: child.id,
                    relativeStart: normalizeCoordinates(child.relativeStart.x, child.relativeStart.y),
                    relativeEnd: normalizeCoordinates(child.relativeEnd.x, child.relativeEnd.y),
                    element: child.element && child.element.points && child.element.points.length > 0
                        ? {
                            ...child.element,
                            points: child.element.points.map(p => normalizeCoordinates(p.x, p.y))
                        }
                        : child.element
                }));
            }
            
            sendToAllPeers({
                type: 'ELEMENT_UPDATE',
                id: element.id,
                element: updateData
            });
        });
    }
    
    state.isDrawing = false;
    dragStart = null;
    dragStartElements = null;
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
    
    // Store original bounding box
    const originalBbox = getBoundingBox(element.start, element.end);
    
    // Store original element state
    dragStartElement = {
        start: { ...element.start },
        end: { ...element.end },
        originalBbox: originalBbox,
        // Store original width for stickers
        originalWidth: element.width || state.strokeWidth,
        // Store original points array for pencil/eraser
        originalPoints: element.points ? element.points.map(p => ({ ...p })) : null,
        // Store original group children for groups
        originalGroupChildren: isGroup(element) && element.children 
            ? element.children.map(child => ({
                relativeStart: { ...child.relativeStart },
                relativeEnd: { ...child.relativeEnd },
                element: child.element ? {
                    ...child.element,
                    points: child.element.points ? child.element.points.map(p => ({ ...p })) : null
                } : null
            }))
            : null
    };
    return true;
}

/**
 * Resize selected element
 */
export function resizeElement(point, event = null) {
    if (!state.isResizing || !dragStart || !dragStartElement) return;
    
    const element = getSelectedElement();
    if (!element || !state.resizeHandle || !dragStartElement.originalBbox) return;
    
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;
    
    const handle = state.resizeHandle;
    const originalBbox = dragStartElement.originalBbox;
    
    // Check for Shift key to maintain aspect ratio (for circles and squares)
    const maintainAspectRatio = event && (event.shiftKey || event.getModifierState?.('Shift'));
    const isCircle = element.type === 'circle';
    
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
    
    // Calculate new bounding box
    let newBbox = getBoundingBox(newStart, newEnd);
    
    // Maintain aspect ratio for circles when Shift is held
    if (maintainAspectRatio && isCircle) {
        const size = Math.min(newBbox.width, newBbox.height);
        const centerX = newBbox.centerX;
        const centerY = newBbox.centerY;
        const halfSize = size / 2;
        newStart = { x: centerX - halfSize, y: centerY - halfSize };
        newEnd = { x: centerX + halfSize, y: centerY + halfSize };
        newBbox = getBoundingBox(newStart, newEnd);
    }
    
    // Apply minimum size constraint
    if (newBbox.width < MIN_SIZE) {
        const centerX = newBbox.centerX;
        if (handle.position.includes('left')) {
            newStart.x = centerX - MIN_SIZE / 2;
        }
        if (handle.position.includes('right')) {
            newEnd.x = centerX + MIN_SIZE / 2;
        }
        if (!handle.position.includes('left') && !handle.position.includes('right')) {
            // Center handles - adjust both
            newStart.x = centerX - MIN_SIZE / 2;
            newEnd.x = centerX + MIN_SIZE / 2;
        }
    }
    
    if (newBbox.height < MIN_SIZE) {
        const centerY = newBbox.centerY;
        if (handle.position.includes('top')) {
            newStart.y = centerY - MIN_SIZE / 2;
        }
        if (handle.position.includes('bottom')) {
            newEnd.y = centerY + MIN_SIZE / 2;
        }
        if (!handle.position.includes('top') && !handle.position.includes('bottom')) {
            // Center handles - adjust both
            newStart.y = centerY - MIN_SIZE / 2;
            newEnd.y = centerY + MIN_SIZE / 2;
        }
    }
    
    // Recalculate bbox after minimum size adjustment
    newBbox = getBoundingBox(newStart, newEnd);
    
    // Update element coordinates
    element.start = newStart;
    element.end = newEnd;
    
    // Handle stickers - update width based on bounding box size
    if (element.type === 'sticker') {
        // Calculate new size from bounding box
        // For emojis: fontSize = width * 8, so width = fontSize / 8
        // For icons: fontSize = width * 6, so width = fontSize / 6
        // For images: size = width * 10, so width = size / 10
        // Use average of width and height for consistent scaling
        const avgSize = (newBbox.width + newBbox.height) / 2;
        
        if (element.stickerType === 'emoji') {
            // Emoji: fontSize = width * 8, so width = fontSize / 8
            element.width = Math.max(avgSize / 8, 1);
        } else if (element.stickerType === 'icon') {
            // Icon: fontSize = width * 6, so width = fontSize / 6
            element.width = Math.max(avgSize / 6, 1);
        } else if (element.stickerType === 'image') {
            // Image: size = width * 10, so width = size / 10
            element.width = Math.max(avgSize / 10, 1);
        } else {
            // Default scaling
            element.width = Math.max(avgSize / 8, 1);
        }
    }
    
    // Handle groups - scale all children proportionally
    if (isGroup(element) && element.children && dragStartElement.originalGroupChildren) {
        scaleGroupChildren(element, originalBbox, newBbox, dragStartElement.originalGroupChildren);
    }
    
    // Handle pencil/eraser - scale points array proportionally
    if ((element.type === 'pencil' || element.type === 'eraser') && 
        element.points && element.points.length > 0 && 
        dragStartElement.originalPoints) {
        element.points = scalePoints(dragStartElement.originalPoints, originalBbox, newBbox);
    }
    
    redrawCanvas();
}

/**
 * End resize operation
 */
export function endResize() {
    const element = getSelectedElement();
    if (state.isResizing && element && state.isCollaborating) {
        const updateData = {
            start: normalizeCoordinates(element.start.x, element.start.y),
            end: normalizeCoordinates(element.end.x, element.end.y)
        };
        
        // Include width for stickers (so size is preserved)
        if (element.type === 'sticker') {
            updateData.width = element.width;
        }
        
        // Include points array for pencil/eraser elements
        if (element.points && element.points.length > 0) {
            updateData.points = element.points.map(p => normalizeCoordinates(p.x, p.y));
        }
        
        // Include children for groups
        if (isGroup(element) && element.children) {
            updateData.children = element.children.map(child => ({
                id: child.id,
                relativeStart: normalizeCoordinates(child.relativeStart.x, child.relativeStart.y),
                relativeEnd: normalizeCoordinates(child.relativeEnd.x, child.relativeEnd.y),
                // Include points if child has them
                element: child.element && child.element.points && child.element.points.length > 0
                    ? {
                        ...child.element,
                        points: child.element.points.map(p => normalizeCoordinates(p.x, p.y))
                    }
                    : child.element
            }));
        }
        
        sendToAllPeers({
            type: 'ELEMENT_UPDATE',
            id: element.id,
            element: updateData
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

