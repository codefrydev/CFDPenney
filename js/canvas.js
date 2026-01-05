// Canvas Utilities
import { state } from './state.js';

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
        } else if (el.type === 'rect') {
            ctx.strokeRect(el.start.x, el.start.y, el.end.x - el.start.x, el.end.y - el.start.y);
        } else if (el.type === 'text_rendered') {
            ctx.font = `${el.width * 6}px sans-serif`;
            ctx.fillStyle = el.color;
            ctx.fillText(el.text, el.start.x, el.start.y);
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

    ctx.globalCompositeOperation = 'source-over';
}

export function getCanvas() {
    return canvas;
}

export function getCtx() {
    return ctx;
}

// Normalize coordinates to 0.0-1.0 range for cross-resolution collaboration
export function normalizeCoordinates(x, y) {
    if (!canvas) return { x: 0, y: 0 };
    return {
        x: canvas.width > 0 ? x / canvas.width : 0,
        y: canvas.height > 0 ? y / canvas.height : 0
    };
}

// Denormalize coordinates from 0.0-1.0 range to pixel coordinates
export function denormalizeCoordinates(normX, normY) {
    if (!canvas) return { x: 0, y: 0 };
    return {
        x: normX * canvas.width,
        y: normY * canvas.height
    };
}

