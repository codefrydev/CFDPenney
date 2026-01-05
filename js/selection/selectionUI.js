// Selection UI
// Provides visual feedback for selected elements (highlight box, handles)
import { state } from '../state.js';
import { getCtx } from '../canvas.js';
import { getBoundingBox } from '../shapes/shapeUtils.js';

const HANDLE_SIZE = 8;
const HANDLE_COLOR = '#007AFF';
const HANDLE_FILL = '#FFFFFF';
const SELECTION_COLOR = '#007AFF';
const SELECTION_DASH = [5, 5];

/**
 * Draw selection handles around an element
 */
export function drawSelectionHandles(element) {
    if (!element) return;
    
    const ctx = getCtx();
    if (!ctx) return;
    
    const bbox = getBoundingBox(element.start, element.end);
    
    // Draw selection rectangle
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeRect(bbox.x - 5, bbox.y - 5, bbox.width + 10, bbox.height + 10);
    ctx.setLineDash([]);
    
    // Draw resize handles (8 handles for rectangle)
    const handles = getResizeHandles(bbox);
    handles.forEach(handle => {
        drawHandle(ctx, handle.x, handle.y);
    });
    
    // Draw rotation handle (top center)
    const rotationHandle = {
        x: bbox.centerX,
        y: bbox.y - 20
    };
    drawRotationHandle(ctx, rotationHandle.x, rotationHandle.y);
}

/**
 * Get resize handle positions
 */
function getResizeHandles(bbox) {
    return [
        { x: bbox.x, y: bbox.y }, // Top-left
        { x: bbox.x + bbox.width, y: bbox.y }, // Top-right
        { x: bbox.x, y: bbox.y + bbox.height }, // Bottom-left
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // Bottom-right
        { x: bbox.centerX, y: bbox.y }, // Top-center
        { x: bbox.centerX, y: bbox.y + bbox.height }, // Bottom-center
        { x: bbox.x, y: bbox.centerY }, // Left-center
        { x: bbox.x + bbox.width, y: bbox.centerY } // Right-center
    ];
}

/**
 * Draw a resize handle
 */
function drawHandle(ctx, x, y) {
    ctx.fillStyle = HANDLE_FILL;
    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
}

/**
 * Draw rotation handle
 */
function drawRotationHandle(ctx, x, y) {
    ctx.fillStyle = HANDLE_FILL;
    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_SIZE / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Draw rotation icon (circular arrow)
    ctx.strokeStyle = HANDLE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_SIZE / 2 + 2, 0, Math.PI * 1.5);
    ctx.stroke();
}

/**
 * Check if point is on a resize handle
 */
export function getHandleAtPoint(point, element) {
    if (!element) return null;
    
    const bbox = getBoundingBox(element.start, element.end);
    const handles = getResizeHandles(bbox);
    
    for (let i = 0; i < handles.length; i++) {
        const handle = handles[i];
        const dx = point.x - handle.x;
        const dy = point.y - handle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Use larger threshold for easier clicking (handle size + some padding)
        if (distance < HANDLE_SIZE + 4) {
            return {
                index: i,
                position: getHandlePosition(i),
                x: handle.x,
                y: handle.y
            };
        }
    }
    
    // Check rotation handle
    const rotationHandle = { x: bbox.centerX, y: bbox.y - 20 };
    const dx = point.x - rotationHandle.x;
    const dy = point.y - rotationHandle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Use larger threshold for easier clicking
    if (distance < HANDLE_SIZE + 4) {
        return { index: -1, position: 'rotate', x: rotationHandle.x, y: rotationHandle.y };
    }
    
    return null;
}

/**
 * Get handle position name
 */
function getHandlePosition(index) {
    const positions = [
        'top-left', 'top-right', 'bottom-left', 'bottom-right',
        'top-center', 'bottom-center', 'left-center', 'right-center'
    ];
    return positions[index] || 'unknown';
}

/**
 * Draw selection box (for multi-selection)
 */
export function drawSelectionBox() {
    if (!state.isMultiSelecting || !state.selectionBoxStart || !state.selectionBoxEnd) return;
    
    const ctx = getCtx();
    if (!ctx) return;
    
    const bbox = getBoundingBox(state.selectionBoxStart, state.selectionBoxEnd);
    
    // Only draw if box has some size
    if (bbox.width < 5 || bbox.height < 5) return;
    
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.fillStyle = 'rgba(0, 122, 255, 0.1)';
    ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    ctx.setLineDash([]);
}

/**
 * Render selection UI
 */
export function renderSelection() {
    // Draw selection box if multi-selecting (draw this first so it's behind handles)
    drawSelectionBox();
    
    // Draw selection handles for selected element
    if (state.selectedElementId && state.selectedElementIndex >= 0) {
        const element = state.elements[state.selectedElementIndex];
        if (element) {
            drawSelectionHandles(element);
        }
    }
    
    // Draw visual indicator for multi-selected elements
    if (state.selectedElementIds && state.selectedElementIds.length > 1) {
        const ctx = getCtx();
        if (ctx) {
            const elements = state.elements.slice(0, state.historyStep + 1);
            state.selectedElementIds.forEach(id => {
                const el = elements.find(e => e.id === id);
                if (el && el.id !== state.selectedElementId) {
                    // Draw a subtle highlight for other selected elements
                    const bbox = getBoundingBox(el.start, el.end);
                    ctx.strokeStyle = SELECTION_COLOR;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.strokeRect(bbox.x - 3, bbox.y - 3, bbox.width + 6, bbox.height + 6);
                    ctx.setLineDash([]);
                }
            });
        }
    }
}

