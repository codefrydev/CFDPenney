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
 * @param {Object} point - Point to check
 * @param {boolean} addToSelection - If true, add to existing selection (Ctrl/Cmd+Click)
 * @param {boolean} toggleSelection - If true, toggle selection state (Shift+Click)
 * @returns {boolean} True if element was found and selected
 */
export function selectElementAtPoint(point, addToSelection = false, toggleSelection = false) {
    const result = getElementAtPoint(point);
    if (result) {
        // Ensure selectedElementIds is initialized
        if (!state.selectedElementIds) {
            state.selectedElementIds = [];
        }
        
        const elementId = result.element.id;
        const isAlreadySelected = state.selectedElementIds.includes(elementId);
        
        if (toggleSelection) {
            // Shift+Click: Toggle selection
            if (isAlreadySelected) {
                // Remove from selection
                state.selectedElementIds = state.selectedElementIds.filter(id => id !== elementId);
                if (state.selectedElementId === elementId) {
                    // If removing primary selection, set new primary
                    if (state.selectedElementIds.length > 0) {
                        const newPrimaryIndex = state.elements.findIndex(el => el.id === state.selectedElementIds[0]);
                        if (newPrimaryIndex >= 0) {
                            state.selectedElementId = state.selectedElementIds[0];
                            state.selectedElementIndex = newPrimaryIndex;
                        }
                    } else {
                        clearSelection();
                    }
                }
            } else {
                // Add to selection
                state.selectedElementIds.push(elementId);
                state.selectedElementId = elementId;
                state.selectedElementIndex = result.index;
            }
        } else if (addToSelection) {
            // Ctrl/Cmd+Click: Add to selection
            if (!isAlreadySelected) {
                state.selectedElementIds.push(elementId);
            }
            // Always set as primary selection
            state.selectedElementId = elementId;
            state.selectedElementIndex = result.index;
        } else {
            // Single selection
            state.selectedElementId = elementId;
            state.selectedElementIndex = result.index;
            state.selectedElementIds = [elementId];
        }
        return true;
    } else {
        if (!addToSelection && !toggleSelection) {
            clearSelection();
        }
        return false;
    }
}

/**
 * Check if two rectangles intersect
 */
function rectanglesIntersect(rect1, rect2) {
    return rect1.x <= rect2.x + rect2.width &&
           rect1.x + rect1.width >= rect2.x &&
           rect1.y <= rect2.y + rect2.height &&
           rect1.y + rect1.height >= rect2.y;
}

/**
 * Check if rectangle1 contains rectangle2
 */
function rectangleContains(rect1, rect2) {
    return rect1.x <= rect2.x &&
           rect1.y <= rect2.y &&
           rect1.x + rect1.width >= rect2.x + rect2.width &&
           rect1.y + rect1.height >= rect2.y + rect2.height;
}

/**
 * Get element bounding box with proper handling for different element types
 */
function getElementBoundingBox(element) {
    if (!element || !element.start) return null;
    
    // For groups, use the group's bounding box
    if (element.type === 'group') {
        return getBoundingBox(element.start, element.end);
    }
    
    // For pencil/eraser, calculate bounding box from points
    if (element.type === 'pencil' || element.type === 'eraser') {
        if (!element.points || element.points.length === 0) return null;
        const xs = element.points.map(p => p.x);
        const ys = element.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
    
    // For text, calculate approximate bounding box
    if (element.type === 'text_rendered') {
        const textWidth = (element.text?.length || 0) * (element.width * 3 || 12);
        const textHeight = element.width * 6 || 24;
        return {
            x: element.start.x,
            y: element.start.y - textHeight,
            width: textWidth,
            height: textHeight,
            centerX: element.start.x + textWidth / 2,
            centerY: element.start.y - textHeight / 2
        };
    }
    
    // For stickers, calculate from size
    if (element.type === 'sticker') {
        const size = element.width * 10 || 40;
        const halfSize = size / 2;
        return {
            x: element.start.x - halfSize,
            y: element.start.y - halfSize,
            width: size,
            height: size,
            centerX: element.start.x,
            centerY: element.start.y
        };
    }
    
    // For lines and arrows, create a bounding box with padding for hit testing
    if (element.type === 'line' || element.type === 'arrow') {
        const padding = (element.width || 5) / 2;
        const bbox = getBoundingBox(element.start, element.end);
        return {
            x: bbox.x - padding,
            y: bbox.y - padding,
            width: bbox.width + padding * 2,
            height: bbox.height + padding * 2,
            centerX: bbox.centerX,
            centerY: bbox.centerY
        };
    }
    
    // For all other shapes, use standard bounding box
    return getBoundingBox(element.start, element.end);
}

/**
 * Get elements in selection box
 * @param {Object} boxStart - Start point of selection box
 * @param {Object} boxEnd - End point of selection box
 * @param {string} mode - 'contain' (default) or 'intersect'
 * @returns {Array} Array of {element, index} objects
 */
export function getElementsInBox(boxStart, boxEnd, mode = 'intersect') {
    const bbox = getBoundingBox(boxStart, boxEnd);
    const elements = state.elements.slice(0, state.historyStep + 1);
    const selected = [];
    
    // Minimum size threshold to avoid selecting with tiny boxes (but allow small boxes for selection)
    const minSize = 1;
    if (bbox.width < minSize || bbox.height < minSize) {
        return selected;
    }
    
    elements.forEach((el, index) => {
        // Skip elements without IDs (they can't be selected)
        if (!el || !el.id) return;
        
        const elBbox = getElementBoundingBox(el);
        if (!elBbox) return;
        
        if (mode === 'contain') {
            // Element must be completely contained within selection box
            if (rectangleContains(bbox, elBbox)) {
                selected.push({ element: el, index });
            }
        } else {
            // Element intersects with selection box (default behavior)
            if (rectanglesIntersect(bbox, elBbox)) {
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
    state.isDraggingSelection = false;
    state.selectionBoxStart = null;
    state.selectionBoxEnd = null;
    state.dragStartPoint = null;
}

/**
 * Get all selected elements
 * @returns {Array} Array of {element, index} objects
 */
export function getSelectedElements() {
    if (!state.selectedElementIds || state.selectedElementIds.length === 0) {
        return [];
    }
    
    const elements = state.elements.slice(0, state.historyStep + 1);
    const selected = [];
    
    state.selectedElementIds.forEach(id => {
        const index = elements.findIndex(el => el.id === id);
        if (index >= 0) {
            selected.push({ element: elements[index], index });
        }
    });
    
    return selected;
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

