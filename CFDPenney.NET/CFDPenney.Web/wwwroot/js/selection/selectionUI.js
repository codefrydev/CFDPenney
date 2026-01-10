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
const SELECTION_FILL_OPACITY = 0.15;
const MULTI_SELECTION_COLOR = '#007AFF';
const MULTI_SELECTION_DASH = [3, 3];

// Animation state for marching ants effect
let dashOffset = 0;
let lastAnimationTime = 0;

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
 * Draw selection box (for multi-selection) with marching ants effect
 */
export function drawSelectionBox() {
    if (!state.isMultiSelecting || !state.selectionBoxStart || !state.selectionBoxEnd) return;
    
    const ctx = getCtx();
    if (!ctx) return;
    
    const bbox = getBoundingBox(state.selectionBoxStart, state.selectionBoxEnd);
    
    // Draw even for small boxes (minimum 1px to show something is happening)
    if (bbox.width < 1 || bbox.height < 1) return;
    
    // Update dash offset for marching ants effect
    const now = Date.now();
    if (lastAnimationTime === 0) {
        lastAnimationTime = now;
    }
    const deltaTime = now - lastAnimationTime;
    dashOffset += deltaTime * 0.1; // Adjust speed of animation
    if (dashOffset > 20) dashOffset = 0;
    lastAnimationTime = now;
    
    // Draw fill (semi-transparent blue)
    ctx.fillStyle = `rgba(0, 122, 255, ${SELECTION_FILL_OPACITY})`;
    ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
    
    // Draw border with marching ants effect (more visible)
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
}

/**
 * Reset animation state (call when selection box ends)
 */
export function resetSelectionBoxAnimation() {
    dashOffset = 0;
    lastAnimationTime = 0;
}

/**
 * Draw highlight for a selected element (without handles)
 */
function drawElementHighlight(element, isPrimary = false) {
    if (!element) return;
    
    const ctx = getCtx();
    if (!ctx) return;
    
    const bbox = getBoundingBox(element.start, element.end);
    
    // Draw highlight rectangle with more visible styling
    if (isPrimary) {
        // Primary selection gets a thicker, more prominent border
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(SELECTION_DASH);
    } else {
        // Secondary selections get a thinner, dashed border (but still visible)
        ctx.strokeStyle = MULTI_SELECTION_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash(MULTI_SELECTION_DASH);
    }
    
    const padding = isPrimary ? 5 : 4;
    ctx.strokeRect(
        bbox.x - padding,
        bbox.y - padding,
        bbox.width + padding * 2,
        bbox.height + padding * 2
    );
    ctx.setLineDash([]);
}

/**
 * Render selection UI
 */
export function renderSelection() {
    // Draw selection box if multi-selecting (draw this first so it's behind handles)
    drawSelectionBox();
    
    const ctx = getCtx();
    if (!ctx) return;
    
    const elements = state.elements.slice(0, state.historyStep + 1);
    
    // Draw highlights for all selected elements first
    if (state.selectedElementIds && state.selectedElementIds.length > 0) {
        state.selectedElementIds.forEach(id => {
            const el = elements.find(e => e.id === id);
            if (el) {
                const isPrimary = el.id === state.selectedElementId;
                drawElementHighlight(el, isPrimary);
            }
        });
    }
    
    // Draw selection handles for primary selected element (on top)
    if (state.selectedElementId && state.selectedElementIndex >= 0) {
        const element = state.elements[state.selectedElementIndex];
        if (element) {
            drawSelectionHandles(element);
        }
    }
    
    // Draw selection count indicator if multiple elements selected (while dragging)
    if (state.selectedElementIds && state.selectedElementIds.length > 1 && state.isMultiSelecting && state.selectionBoxStart && state.selectionBoxEnd) {
        const bbox = getBoundingBox(state.selectionBoxStart, state.selectionBoxEnd);
        if (bbox.width >= 5 && bbox.height >= 5) {
            drawSelectionCount(bbox, state.selectedElementIds.length);
        }
    }
}

/**
 * Draw selection count indicator
 */
function drawSelectionCount(bbox, count) {
    const ctx = getCtx();
    if (!ctx) return;
    
    const text = `${count} selected`;
    const padding = 8;
    const fontSize = 12;
    
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    
    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    // Draw background
    const bgX = bbox.x + padding;
    const bgY = bbox.y + padding;
    const bgWidth = textWidth + padding * 2;
    const bgHeight = textHeight + padding;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    
    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, bgX + padding, bgY + padding / 2);
}

