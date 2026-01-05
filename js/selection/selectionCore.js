// Selection Core Logic
// Provides hit testing and selection state management
import { state } from '../state.js';
import { isPointInCircle, isPointInRect, isPointInPolygon, getBoundingBox } from '../shapes/shapeUtils.js';

/**
 * Check if a point hits an element
 */
export function hitTestElement(point, element) {
    if (!element || !element.start) return false;
    
    // Handle groups
    if (element.type === 'group') {
        return isPointInRect(point, element.start, element.end);
    }
    
    switch (element.type) {
        case 'pencil':
        case 'eraser':
            // Check if point is near any point in the path
            return element.points.some(p => {
                const dx = p.x - point.x;
                const dy = p.y - point.y;
                return Math.sqrt(dx * dx + dy * dy) < (element.width || 10);
            });
        
        case 'rect':
            return isPointInRect(point, element.start, element.end);
        
        case 'circle':
            const bbox = getBoundingBox(element.start, element.end);
            const center = { x: bbox.centerX, y: bbox.centerY };
            const radius = Math.min(bbox.width, bbox.height) / 2;
            return isPointInCircle(point, center, radius);
        
        case 'ellipse':
            const ebbox = getBoundingBox(element.start, element.end);
            const ecenter = { x: ebbox.centerX, y: ebbox.centerY };
            const radiusX = ebbox.width / 2;
            const radiusY = ebbox.height / 2;
            // Ellipse hit test
            const dx = (point.x - ecenter.x) / radiusX;
            const dy = (point.y - ecenter.y) / radiusY;
            return (dx * dx + dy * dy) <= 1;
        
        case 'line':
        case 'arrow':
            // Check if point is near the line
            return isPointNearLine(point, element.start, element.end, element.width || 5);
        
        case 'triangle':
        case 'diamond':
        case 'star':
        case 'pentagon':
        case 'hexagon':
        case 'octagon':
            // For polygons, we'd need to get the points and check
            // For now, use bounding box
            return isPointInRect(point, element.start, element.end);
        
        case 'text_rendered':
            // Approximate text bounding box
            const textWidth = (element.text?.length || 0) * (element.width * 3 || 12);
            const textHeight = element.width * 6 || 24;
            return point.x >= element.start.x && 
                   point.x <= element.start.x + textWidth &&
                   point.y >= element.start.y - textHeight && 
                   point.y <= element.start.y;
        
        case 'sticker':
            // Stickers are circular/rectangular
            const size = element.width * 10 || 40;
            const halfSize = size / 2;
            return point.x >= element.start.x - halfSize &&
                   point.x <= element.start.x + halfSize &&
                   point.y >= element.start.y - halfSize &&
                   point.y <= element.start.y + halfSize;
        
        default:
            return false;
    }
}

/**
 * Check if point is near a line segment
 */
function isPointNearLine(point, start, end, threshold) {
    const A = point.x - start.x;
    const B = point.y - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = start.x;
        yy = start.y;
    } else if (param > 1) {
        xx = end.x;
        yy = end.y;
    } else {
        xx = start.x + param * C;
        yy = start.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
}

/**
 * Find element at point
 */
export function getElementAtPoint(point) {
    // Check elements in reverse order (top to bottom)
    const elements = state.elements.slice(0, state.historyStep + 1);
    for (let i = elements.length - 1; i >= 0; i--) {
        if (hitTestElement(point, elements[i])) {
            return { element: elements[i], index: i };
        }
    }
    return null;
}

/**
 * Select element at point
 */
export function selectElementAtPoint(point, addToSelection = false) {
    const result = getElementAtPoint(point);
    if (result) {
        // Ensure selectedElementIds is initialized
        if (!state.selectedElementIds) {
            state.selectedElementIds = [];
        }
        
        if (addToSelection) {
            // Add to multi-selection
            if (!state.selectedElementIds.includes(result.element.id)) {
                state.selectedElementIds.push(result.element.id);
            }
            // Also set as primary selection
            state.selectedElementId = result.element.id;
            state.selectedElementIndex = result.index;
        } else {
            // Single selection
            state.selectedElementId = result.element.id;
            state.selectedElementIndex = result.index;
            state.selectedElementIds = [result.element.id];
        }
        return true;
    } else {
        if (!addToSelection) {
            clearSelection();
        }
        return false;
    }
}

/**
 * Get elements in selection box
 */
export function getElementsInBox(boxStart, boxEnd) {
    const bbox = getBoundingBox(boxStart, boxEnd);
    const elements = state.elements.slice(0, state.historyStep + 1);
    const selected = [];
    
    elements.forEach((el, index) => {
        if (el.type === 'group') {
            // Check if group bounding box intersects with selection box
            const elBbox = getBoundingBox(el.start, el.end);
            if (bbox.x <= elBbox.x + elBbox.width &&
                bbox.x + bbox.width >= elBbox.x &&
                bbox.y <= elBbox.y + elBbox.height &&
                bbox.y + bbox.height >= elBbox.y) {
                selected.push({ element: el, index });
            }
        } else {
            // Check if element is inside selection box
            const elBbox = getBoundingBox(el.start, el.end);
            const centerX = elBbox.x + elBbox.width / 2;
            const centerY = elBbox.y + elBbox.height / 2;
            
            if (centerX >= bbox.x && centerX <= bbox.x + bbox.width &&
                centerY >= bbox.y && centerY <= bbox.y + bbox.height) {
                selected.push({ element: el, index });
            }
        }
    });
    
    return selected;
}

/**
 * Clear selection
 */
export function clearSelection() {
    state.selectedElementId = null;
    state.selectedElementIndex = -1;
    state.selectedElementIds = [];
    state.isResizing = false;
    state.isRotating = false;
    state.resizeHandle = null;
    state.isMultiSelecting = false;
    state.selectionBoxStart = null;
    state.selectionBoxEnd = null;
}

/**
 * Get selected element
 */
export function getSelectedElement() {
    if (state.selectedElementIndex >= 0 && state.selectedElementIndex < state.elements.length) {
        return state.elements[state.selectedElementIndex];
    }
    return null;
}

/**
 * Delete selected element
 */
export function deleteSelectedElement() {
    if (state.selectedElementIndex >= 0) {
        state.elements.splice(state.selectedElementIndex, 1);
        state.historyStep = Math.min(state.historyStep, state.elements.length - 1);
        clearSelection();
        return true;
    }
    return false;
}

