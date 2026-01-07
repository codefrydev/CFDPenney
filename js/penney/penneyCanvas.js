// Infinite Canvas with Viewport Transform
import { state } from './penneyState.js';
import { renderShape } from '../shapes/shapeRenderer.js';
import { renderSticker } from '../stickers/stickerRenderer.js';
import { renderSelection } from '../selection/selectionUI.js';

// Export getCtx for selection modules (they import from '../canvas.js')
// We'll need to make sure selection modules can access the penney canvas context

let canvas = null;
let ctx = null;
let container = null;

export function initCanvas(canvasEl, containerEl) {
    canvas = canvasEl;
    ctx = canvasEl.getContext('2d');
    container = containerEl;
}

export function resizeCanvas() {
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redrawCanvas();
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(screenX, screenY) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert screen to canvas coordinates
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;
    
    // Convert canvas coordinates to world coordinates (accounting for viewport)
    const worldX = (canvasX / state.zoom) - state.viewportX;
    const worldY = (canvasY / state.zoom) - state.viewportY;
    
    return { x: worldX, y: worldY };
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldX, worldY) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert world to canvas coordinates (accounting for viewport)
    const canvasX = (worldX + state.viewportX) * state.zoom;
    const canvasY = (worldY + state.viewportY) * state.zoom;
    
    // Convert canvas to screen coordinates
    const screenX = (canvasX / scaleX) + rect.left;
    const screenY = (canvasY / scaleY) + rect.top;
    
    return { x: screenX, y: screenY };
}

/**
 * Get mouse position in world coordinates
 */
export function getMousePos(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors to convert from display coordinates to canvas internal coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Handle edge cases (division by zero)
    if (!isFinite(scaleX) || !isFinite(scaleY)) {
        return screenToWorld(e.clientX, e.clientY);
    }
    
    // Convert screen coordinates to world coordinates
    return screenToWorld(e.clientX, e.clientY);
}

/**
 * Set viewport transform
 */
export function setViewport(x, y, zoom) {
    state.viewportX = x;
    state.viewportY = y;
    state.zoom = Math.max(state.minZoom, Math.min(state.maxZoom, zoom));
    redrawCanvas();
}

/**
 * Pan viewport
 * deltaX/deltaY are in world coordinates - positive values move viewport right/down (canvas follows)
 */
export function panViewport(deltaX, deltaY) {
    state.viewportX += deltaX;
    state.viewportY += deltaY;
    redrawCanvas();
}

/**
 * Zoom viewport at a specific point
 */
export function zoomViewport(zoomDelta, centerX, centerY) {
    const oldZoom = state.zoom;
    const newZoom = Math.max(state.minZoom, Math.min(state.maxZoom, state.zoom * zoomDelta));
    
    if (oldZoom === newZoom) return;
    
    // Convert center point to world coordinates
    const worldCenter = screenToWorld(centerX, centerY);
    
    // Adjust viewport to zoom towards the center point
    const zoomFactor = newZoom / oldZoom;
    state.viewportX = worldCenter.x - (centerX / newZoom) + (state.viewportX * zoomFactor);
    state.viewportY = worldCenter.y - (centerY / newZoom) + (state.viewportY * zoomFactor);
    state.zoom = newZoom;
    
    redrawCanvas();
}

/**
 * Reset viewport to default
 */
export function resetViewport() {
    state.viewportX = 0;
    state.viewportY = 0;
    state.zoom = 1;
    redrawCanvas();
}

/**
 * Draw arrow helper
 */
export function drawArrow(ctx, fromx, fromy, tox, toy) {
    const headlen = 15; 
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
}

/**
 * Draw elements with viewport transform
 */
export function drawElements(elements, isPeer = false) {
    if (!ctx || !canvas) return;
    
    // Save context state
    ctx.save();
    
    // Apply viewport transform
    ctx.setTransform(state.zoom, 0, 0, state.zoom, state.viewportX * state.zoom, state.viewportY * state.zoom);
    
    elements.forEach(el => {
        ctx.beginPath();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Make peer elements slightly transparent
        if (isPeer) {
            ctx.globalAlpha = 0.8;
        }

        if (el.type === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = el.width * 2; 
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        if (el.type === 'pencil' || el.type === 'eraser') {
            if (el.points && el.points.length < 2) return;
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
                ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
        } else if (el.type === 'arrow') {
            drawArrow(ctx, el.start.x, el.start.y, el.end.x, el.end.y);
        } else if (el.type === 'text_rendered') {
            ctx.font = `${el.width * 6}px sans-serif`;
            ctx.fillStyle = el.color;
            ctx.fillText(el.text, el.start.x, el.start.y);
        } else if (['line', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'octagon'].includes(el.type)) {
            // Render shapes using shape renderer
            renderShape(ctx, el);
        } else if (el.type === 'sticker') {
            // Render stickers
            renderSticker(ctx, el);
        } else if (el.type === 'group') {
            // Render group - draw all children
            if (el.children) {
                el.children.forEach(child => {
                    const childElement = { ...child.element };
                    // Convert relative positions to absolute
                    childElement.start = {
                        x: el.start.x + child.relativeStart.x,
                        y: el.start.y + child.relativeStart.y
                    };
                    childElement.end = {
                        x: el.start.x + child.relativeEnd.x,
                        y: el.start.y + child.relativeEnd.y
                    };
                    // Recursively render child element
                    if (['line', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'octagon'].includes(childElement.type)) {
                        renderShape(ctx, childElement);
                    } else if (childElement.type === 'sticker') {
                        renderSticker(ctx, childElement);
                    } else if (childElement.type === 'text_rendered') {
                        ctx.font = `${childElement.width * 6}px sans-serif`;
                        ctx.fillStyle = childElement.color;
                        ctx.fillText(childElement.text, childElement.start.x, childElement.start.y);
                    } else if (childElement.type === 'pencil' || childElement.type === 'eraser') {
                        if (childElement.points && childElement.points.length >= 2) {
                            ctx.moveTo(childElement.points[0].x, childElement.points[0].y);
                            for (let i = 1; i < childElement.points.length; i++) {
                                ctx.lineTo(childElement.points[i].x, childElement.points[i].y);
                            }
                            ctx.stroke();
                        }
                    } else if (childElement.type === 'arrow') {
                        drawArrow(ctx, childElement.start.x, childElement.start.y, childElement.end.x, childElement.end.y);
                    }
                });
            }
        }

        if (isPeer) {
            ctx.globalAlpha = 1.0;
        }
    });
    
    // Restore context state
    ctx.restore();
}

/**
 * Redraw canvas with viewport transform
 */
export function redrawCanvas() {
    if (!ctx || !canvas) {
        console.log('[penneyCanvas] redrawCanvas - no ctx or canvas!');
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw local elements
    const itemsToDraw = state.elements.slice(0, state.historyStep + 1);
    console.log('[penneyCanvas] redrawCanvas - drawing', itemsToDraw.length, 'elements, historyStep:', state.historyStep, 'total elements:', state.elements.length);
    if (itemsToDraw.length > 0) {
        console.log('[penneyCanvas] redrawCanvas - first element:', itemsToDraw[0]);
    }
    drawElements(itemsToDraw);

    // Draw peer elements
    if (state.peerElements.length > 0) {
        drawElements(state.peerElements, true);
    }

    // Draw selection UI (needs to account for viewport transform)
    // Selection UI should be rendered in world coordinates with viewport transform
    ctx.save();
    // Apply viewport transform for selection rendering
    ctx.setTransform(state.zoom, 0, 0, state.zoom, state.viewportX * state.zoom, state.viewportY * state.zoom);
    renderSelection();
    ctx.restore();

    ctx.globalCompositeOperation = 'source-over';
}

export function getCanvas() {
    return canvas;
}

export function getCtx() {
    return ctx;
}

/**
 * Normalize coordinates to 0.0-1.0 range for cross-resolution collaboration
 * For infinite canvas, we use a fixed reference size
 */
const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

export function normalizeCoordinates(x, y) {
    return {
        x: x / REFERENCE_WIDTH,
        y: y / REFERENCE_HEIGHT
    };
}

/**
 * Denormalize coordinates from 0.0-1.0 range to world coordinates
 */
export function denormalizeCoordinates(normX, normY) {
    return {
        x: normX * REFERENCE_WIDTH,
        y: normY * REFERENCE_HEIGHT
    };
}

