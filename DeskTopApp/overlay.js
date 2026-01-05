// Overlay Window - Pointer and Annotation Engine
import { state, getPeerColor } from './state.js';
import { sendToAllPeers } from './collaboration/messageSender.js';
import { normalizeCoordinates } from './collaboration/coordinateUtils.js';

// Canvas elements
let canvas = null;
let ctx = null;
let canvasWidth = 0;
let canvasHeight = 0;

// Overlay state
let overlayMode = 'view'; // 'view' or 'draw'
let currentStrokeId = null;
let isDrawing = false;

// Remote state
const remotePointers = new Map(); // Map<peerId, {x, y, color, timestamp}>
const remoteStrokes = new Map(); // Map<strokeId, {peerId, tool, color, width, points[]}>

// Performance optimization
let lastPointerSendTime = 0;
const POINTER_THROTTLE_MS = 16; // ~60fps
let animationFrameId = null;

// Initialize canvas
function initCanvas() {
    canvas = document.getElementById('overlay-canvas');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }
    
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    // Start render loop
    startRenderLoop();
}

// Resize canvas to match window
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    
    // Set canvas size accounting for DPI
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Scale context to match DPI
    ctx.scale(dpr, dpr);
    
    console.log('Canvas resized:', canvasWidth, 'x', canvasHeight, 'DPR:', dpr);
}

// Get mouse position relative to canvas
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Render loop
function startRenderLoop() {
    let frameCount = 0;
    
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Render remote strokes
        remoteStrokes.forEach((stroke) => {
            renderStroke(stroke);
        });
        
        // Render current stroke if drawing
        if (isDrawing && currentStrokeId && remoteStrokes.has(currentStrokeId)) {
            const stroke = remoteStrokes.get(currentStrokeId);
            renderStroke(stroke, true);
        }
        
        // Render remote pointers
        remotePointers.forEach((pointer, peerId) => {
            renderPointer(pointer, peerId);
        });
        
        // Debug logging every 120 frames (~2 seconds at 60fps)
        frameCount++;
        if (frameCount % 120 === 0) {
            if (remoteStrokes.size > 0 || remotePointers.size > 0) {
                console.log('[Overlay Render] Strokes:', remoteStrokes.size, 'Pointers:', remotePointers.size);
            }
        }
        
        animationFrameId = requestAnimationFrame(render);
    }
    
    render();
}

// Render a stroke
function renderStroke(stroke, isActive = false) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    
    ctx.beginPath();
    ctx.strokeStyle = stroke.color || '#FF3B30';
    ctx.lineWidth = stroke.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Make active strokes slightly transparent
    if (isActive) {
        ctx.globalAlpha = 0.8;
    } else {
        ctx.globalAlpha = 1.0;
    }
    
    // Draw the stroke
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
}

// Render a pointer
function renderPointer(pointer, peerId) {
    const { x, y, color } = pointer;
    
    // Draw pointer circle
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = color || '#FF3B30';
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    // Draw peer ID label
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(peerId.substring(0, 5), x, y + 28);
}

// Mouse event handlers
function handleMouseDown(e) {
    if (overlayMode !== 'draw') return;
    
    isDrawing = true;
    const { x, y } = getMousePos(e);
    
    // Create new stroke
    currentStrokeId = `local-${state.myPeerId || 'unknown'}-${Date.now()}`;
    const stroke = {
        id: currentStrokeId,
        peerId: state.myPeerId,
        tool: state.tool || 'pencil',
        color: state.color || '#FF3B30',
        width: state.strokeWidth || 4,
        points: [{ x, y }],
        isActive: true
    };
    
    remoteStrokes.set(currentStrokeId, stroke);
    
    // Send to peers
    const normalized = normalizeCoordinates(x, y, canvasWidth, canvasHeight);
    const message = {
        type: 'STROKE_START',
        id: currentStrokeId,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        nx: normalized.x,
        ny: normalized.y
    };
    
    // Send via IPC to main window for broadcasting
    if (window.electronAPI) {
        window.electronAPI.sendOverlayEvent(message);
    }
}

function handleMouseMove(e) {
    const { x, y } = getMousePos(e);
    
    if (isDrawing && overlayMode === 'draw') {
        // Add point to current stroke
        if (currentStrokeId && remoteStrokes.has(currentStrokeId)) {
            const stroke = remoteStrokes.get(currentStrokeId);
            stroke.points.push({ x, y });
            
            // Send to peers (throttled)
            const normalized = normalizeCoordinates(x, y, canvasWidth, canvasHeight);
            const message = {
                type: 'STROKE_MOVE',
                id: currentStrokeId,
                nx: normalized.x,
                ny: normalized.y
            };
            
            if (window.electronAPI) {
                window.electronAPI.sendOverlayEvent(message);
            }
        }
    } else {
        // Send pointer position (throttled)
        const now = Date.now();
        if (now - lastPointerSendTime > POINTER_THROTTLE_MS) {
            lastPointerSendTime = now;
            
            const normalized = normalizeCoordinates(x, y, canvasWidth, canvasHeight);
            const message = {
                type: 'POINTER_MOVE',
                nx: normalized.x,
                ny: normalized.y
            };
            
            if (window.electronAPI) {
                window.electronAPI.sendOverlayEvent(message);
            }
        }
    }
}

function handleMouseUp(e) {
    if (!isDrawing) return;
    
    isDrawing = false;
    
    // Mark stroke as complete
    if (currentStrokeId && remoteStrokes.has(currentStrokeId)) {
        const stroke = remoteStrokes.get(currentStrokeId);
        stroke.isActive = false;
        
        // Send to peers
        const message = {
            type: 'STROKE_END',
            id: currentStrokeId
        };
        
        if (window.electronAPI) {
            window.electronAPI.sendOverlayEvent(message);
        }
    }
    
    currentStrokeId = null;
}

// Keyboard event handlers
function handleKeyDown(e) {
    switch (e.key.toLowerCase()) {
        case 'p': // Pointer mode
            toggleMode('view');
            break;
        case 'd': // Draw mode
            toggleMode('draw');
            break;
        case 'c': // Clear
            if (e.ctrlKey || e.metaKey) {
                clearOverlay();
            }
            break;
        case 'escape':
            toggleMode('view');
            break;
    }
}

// Toggle overlay mode
function toggleMode(mode) {
    overlayMode = mode || (overlayMode === 'view' ? 'draw' : 'view');
    
    // Update cursor
    canvas.style.cursor = overlayMode === 'draw' ? 'crosshair' : 'none';
    
    // Update click-through in main process
    if (window.electronAPI) {
        window.electronAPI.toggleOverlayMode(overlayMode);
    }
    
    console.log('Overlay mode:', overlayMode);
}

// Clear overlay
function clearOverlay() {
    remoteStrokes.clear();
    currentStrokeId = null;
    isDrawing = false;
    
    // Send to peers
    const message = {
        type: 'CLEAR_OVERLAY'
    };
    
    if (window.electronAPI) {
        window.electronAPI.sendOverlayEvent(message);
    }
}

// IPC event listeners
if (window.electronAPI) {
    // Remote pointer move
    window.electronAPI.onRemotePointerMove((data) => {
        console.log('[Overlay] Received remote pointer:', data);
        const { peerId, x, y, color } = data;
        remotePointers.set(peerId, {
            x, y, color,
            timestamp: Date.now()
        });
        
        // Remove stale pointers (older than 2 seconds)
        const now = Date.now();
        remotePointers.forEach((pointer, pid) => {
            if (now - pointer.timestamp > 2000) {
                remotePointers.delete(pid);
            }
        });
    });
    
    // Remote stroke start
    window.electronAPI.onRemoteStrokeStart((data) => {
        console.log('[Overlay] Received remote stroke start:', data);
        const { id, peerId, tool, color, width, x, y } = data;
        remoteStrokes.set(id, {
            id,
            peerId,
            tool,
            color,
            width,
            points: [{ x, y }],
            isActive: true
        });
        console.log('[Overlay] Remote strokes count:', remoteStrokes.size);
    });
    
    // Remote stroke move
    window.electronAPI.onRemoteStrokeMove((data) => {
        const { id, x, y } = data;
        if (remoteStrokes.has(id)) {
            const stroke = remoteStrokes.get(id);
            stroke.points.push({ x, y });
        }
    });
    
    // Remote stroke end
    window.electronAPI.onRemoteStrokeEnd((data) => {
        console.log('[Overlay] Received remote stroke end:', data);
        const { id } = data;
        if (remoteStrokes.has(id)) {
            const stroke = remoteStrokes.get(id);
            stroke.isActive = false;
        }
    });
    
    // Clear overlay
    window.electronAPI.onClearOverlay(() => {
        console.log('[Overlay] Clearing overlay');
        remoteStrokes.clear();
        currentStrokeId = null;
        isDrawing = false;
    });
    
    // Bounds changed (window resize/move)
    window.electronAPI.onBoundsChanged((data) => {
        resizeCanvas();
    });
    
    // Overlay mode changed
    window.electronAPI.onOverlayModeChanged((mode) => {
        overlayMode = mode;
        canvas.style.cursor = overlayMode === 'draw' ? 'crosshair' : 'none';
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Overlay] DOMContentLoaded - initializing...');
    initCanvas();
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    
    console.log('[Overlay] Overlay initialized, canvas size:', canvasWidth, 'x', canvasHeight);
    console.log('[Overlay] electronAPI available:', !!window.electronAPI);
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});

