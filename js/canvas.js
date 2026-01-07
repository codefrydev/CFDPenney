// Canvas Utilities
import { state } from './state.js';
import { renderShape } from './shapes/shapeRenderer.js';
import { renderSticker } from './stickers/stickerRenderer.js';
import { renderSelection } from './selection/selectionUI.js';

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
    // redrawCanvas will be called by the caller
}

export function getMousePos(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors to convert from display coordinates to canvas internal coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Handle edge cases (division by zero)
    if (!isFinite(scaleX) || !isFinite(scaleY)) {
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

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

export function drawElements(elements, isPeer = false) {
    if (!ctx || !canvas) return;
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
            if (el.points.length < 2) return;
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
            // Shape renderer functions are self-contained and set their own context properties
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
}

export function redrawCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw local elements
    const itemsToDraw = state.elements.slice(0, state.historyStep + 1);
    drawElements(itemsToDraw);

    // Draw peer elements
    if (state.peerElements.length > 0) {
        drawElements(state.peerElements, true);
    }

    // Draw selection UI
    renderSelection();

    ctx.globalCompositeOperation = 'source-over';
}

export function getCanvas() {
    return canvas;
}

export function getCtx() {
    return ctx;
}

// Convert canvas coordinates to video content area coordinates (accounting for object-fit: contain)
function canvasToVideoCoords(canvasX, canvasY) {
    // If not in screen mode, return canvas coordinates as-is
    if (state.mode !== 'screen') {
        return { x: canvasX, y: canvasY };
    }
    
    const videoElem = document.getElementById('screen-video');
    if (!videoElem || !videoElem.srcObject || !videoElem.videoWidth || !videoElem.videoHeight) {
        return { x: canvasX, y: canvasY };
    }
    
    const videoWidth = videoElem.videoWidth;
    const videoHeight = videoElem.videoHeight;
    const videoRect = videoElem.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate video content area (accounting for object-fit: contain)
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = videoRect.width / videoRect.height;
    
    let contentWidth, contentHeight, contentLeft, contentTop;
    
    if (videoAspect > containerAspect) {
        // Letterboxing (black bars top/bottom)
        contentWidth = videoRect.width;
        contentHeight = videoRect.width / videoAspect;
        contentLeft = videoRect.left;
        contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
    } else {
        // Pillarboxing (black bars left/right)
        contentHeight = videoRect.height;
        contentWidth = videoRect.height * videoAspect;
        contentTop = videoRect.top;
        contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
    }
    
    // Convert canvas coordinates (relative to canvas) to screen coordinates
    const screenX = canvasRect.left + (canvasX / canvas.width) * canvasRect.width;
    const screenY = canvasRect.top + (canvasY / canvas.height) * canvasRect.height;
    
    // Convert screen coordinates to video content area coordinates
    const videoX = ((screenX - contentLeft) / contentWidth) * videoWidth;
    const videoY = ((screenY - contentTop) / contentHeight) * videoHeight;
    
    return { x: videoX, y: videoY };
}

// Convert video content area coordinates to canvas coordinates
function videoToCanvasCoords(videoX, videoY) {
    // If not in screen mode, return as canvas coordinates
    if (state.mode !== 'screen') {
        return { x: videoX, y: videoY };
    }
    
    const videoElem = document.getElementById('screen-video');
    if (!videoElem || !videoElem.srcObject || !videoElem.videoWidth || !videoElem.videoHeight) {
        return { x: videoX, y: videoY };
    }
    
    const videoWidth = videoElem.videoWidth;
    const videoHeight = videoElem.videoHeight;
    const videoRect = videoElem.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate video content area (accounting for object-fit: contain)
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = videoRect.width / videoRect.height;
    
    let contentWidth, contentHeight, contentLeft, contentTop;
    
    if (videoAspect > containerAspect) {
        // Letterboxing
        contentWidth = videoRect.width;
        contentHeight = videoRect.width / videoAspect;
        contentLeft = videoRect.left;
        contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
    } else {
        // Pillarboxing
        contentHeight = videoRect.height;
        contentWidth = videoRect.height * videoAspect;
        contentTop = videoRect.top;
        contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
    }
    
    // Convert video coordinates to screen coordinates
    const screenX = contentLeft + (videoX / videoWidth) * contentWidth;
    const screenY = contentTop + (videoY / videoHeight) * contentHeight;
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = ((screenX - canvasRect.left) / canvasRect.width) * canvas.width;
    const canvasY = ((screenY - canvasRect.top) / canvasRect.height) * canvas.height;
    
    return { x: canvasX, y: canvasY };
}

// Normalize coordinates to 0.0-1.0 range for cross-resolution collaboration
// In screen mode, normalizes based on video dimensions; otherwise uses canvas dimensions
export function normalizeCoordinates(x, y) {
    if (!canvas) return { x: 0, y: 0 };
    
    // In screen mode, normalize based on video dimensions
    if (state.mode === 'screen') {
        const videoElem = document.getElementById('screen-video');
        if (videoElem && videoElem.srcObject && videoElem.videoWidth && videoElem.videoHeight) {
            // Convert canvas coordinates to video coordinates
            const videoCoords = canvasToVideoCoords(x, y);
            // Normalize by video dimensions
            return {
                x: videoElem.videoWidth > 0 ? videoCoords.x / videoElem.videoWidth : 0,
                y: videoElem.videoHeight > 0 ? videoCoords.y / videoElem.videoHeight : 0
            };
        }
    }
    
    // Default: normalize by canvas dimensions
    return {
        x: canvas.width > 0 ? x / canvas.width : 0,
        y: canvas.height > 0 ? y / canvas.height : 0
    };
}

// Denormalize coordinates from 0.0-1.0 range to pixel coordinates
// In screen mode, denormalizes based on video dimensions; otherwise uses canvas dimensions
export function denormalizeCoordinates(normX, normY) {
    if (!canvas) return { x: 0, y: 0 };
    
    // In screen mode, denormalize based on video dimensions
    if (state.mode === 'screen') {
        const videoElem = document.getElementById('screen-video');
        if (videoElem && videoElem.srcObject && videoElem.videoWidth && videoElem.videoHeight) {
            // Denormalize by video dimensions
            const videoX = normX * videoElem.videoWidth;
            const videoY = normY * videoElem.videoHeight;
            // Convert video coordinates to canvas coordinates
            return videoToCanvasCoords(videoX, videoY);
        }
    }
    
    // Default: denormalize by canvas dimensions
    return {
        x: normX * canvas.width,
        y: normY * canvas.height
    };
}

