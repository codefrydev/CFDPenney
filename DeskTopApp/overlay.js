// Overlay Window - Pointer and Annotation Engine
import { state, getPeerColor } from './state.js';
import { sendToAllPeers as sharedSendToAllPeers } from '../shared/collaboration/messageSender.js';
import { desktopAdapter } from '../shared/adapters/desktopAdapter.js';
import { getTrailOpacity, cleanupExpiredTrails, hasActiveTrails, initTrails } from './trails.js';

// Wrapper for sendToAllPeers with state
function sendToAllPeers(message) {
    return sharedSendToAllPeers(state, message);
}

// Use adapter for coordinate normalization
function normalizeCoordinates(x, y) {
    return desktopAdapter.normalizeCoordinates(x, y);
}

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
// Note: canvasWidth and canvasHeight should be set to screen dimensions
// for accurate coordinate mapping (1:1 pixel alignment)
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // If canvasWidth/Height haven't been set to screen dimensions yet,
    // use window dimensions as fallback
    if (!canvasWidth || !canvasHeight) {
        canvasWidth = rect.width;
        canvasHeight = rect.height;
    }
    
    // Set canvas size accounting for DPI
    // Use logical dimensions (canvasWidth/canvasHeight) for coordinate calculations
    // but render at DPI-scaled resolution for crisp rendering
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Scale context to match DPI
    ctx.scale(dpr, dpr);
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
        
        // Clean up expired trails periodically (every 60 frames = ~1 second at 60fps)
        if (frameCount % 60 === 0 && hasActiveTrails(remoteStrokes)) {
            cleanupExpiredTrails(remoteStrokes);
        }
        
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
        
        animationFrameId = requestAnimationFrame(render);
    }
    
    render();
}

// Render a stroke
function renderStroke(stroke, isActive = false) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    
    // Special rendering for trail strokes
    if (stroke.tool === 'trail') {
        renderTrailStroke(stroke, isActive);
        return;
    }
    
    ctx.beginPath();
    ctx.strokeStyle = stroke.color || '#FF3B30';
    ctx.lineWidth = stroke.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (isActive) {
        ctx.globalAlpha = 0.8;
    } else {
        ctx.globalAlpha = 1.0;
    }
    
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
}

// Render trail stroke with special effects
function renderTrailStroke(stroke, isActive = false) {
    const trailType = stroke.trailType || 'fade';
    const totalPoints = stroke.points.length;
    
    ctx.strokeStyle = stroke.color || '#FF3B30';
    ctx.lineWidth = stroke.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (trailType === 'sequential') {
        // Snake trail
        for (let i = 0; i < totalPoints - 1; i++) {
            ctx.beginPath();
            ctx.moveTo(stroke.points[i].x, stroke.points[i].y);
            ctx.lineTo(stroke.points[i + 1].x, stroke.points[i + 1].y);
            
            let opacity = getTrailOpacity(stroke, i, totalPoints);
            if (isActive) opacity *= 0.8;
            ctx.globalAlpha = opacity;
            
            ctx.stroke();
        }
    } else if (trailType === 'laser') {
        // Laser effect
        const baseOpacity = getTrailOpacity(stroke);
        ctx.globalAlpha = isActive ? baseOpacity * 0.8 : baseOpacity;
        
        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = stroke.color;
        ctx.lineWidth = (stroke.width || 4) + 4;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < totalPoints; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        
        // Core
        ctx.shadowBlur = 8;
        ctx.lineWidth = stroke.width || 4;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < totalPoints; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    } else {
        // Regular fade
        let opacity = getTrailOpacity(stroke);
        if (isActive) opacity *= 0.8;
        ctx.globalAlpha = opacity;
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < totalPoints; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    }
    
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
    
    // Add timestamp and type for trail strokes
    if (state.tool === 'trail') {
        stroke.timestamp = Date.now();
        stroke.trailType = state.trailType || 'fade';
    }
    
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
    
    // Include timestamp and type for trail strokes
    if (state.tool === 'trail') {
        message.timestamp = stroke.timestamp;
        message.trailType = stroke.trailType;
    }
    
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
            
            // Send to peers (throttled to reduce network overhead)
            const now = Date.now();
            if (now - lastPointerSendTime > POINTER_THROTTLE_MS) {
                lastPointerSendTime = now;
                
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
        const { peerId, nx, ny, color } = data;
        
        // Denormalize using OUR canvas dimensions
        const x = nx * canvasWidth;
        const y = ny * canvasHeight;
        
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
        const { id, peerId, tool, color, width, nx, ny, timestamp, trailType } = data;
        
        // Denormalize using OUR canvas dimensions
        const x = nx * canvasWidth;
        const y = ny * canvasHeight;
        
        const newStroke = {
            id,
            peerId,
            tool,
            color,
            width,
            points: [{ x, y }],
            isActive: true
        };
        
        // Add timestamp and type for trail strokes
        if (tool === 'trail' && timestamp) {
            newStroke.timestamp = timestamp;
            newStroke.trailType = trailType || 'fade';
        }
        
        remoteStrokes.set(id, newStroke);
    });
    
    // Remote stroke move
    window.electronAPI.onRemoteStrokeMove((data) => {
        const { id, nx, ny } = data;
        
        // Denormalize using OUR canvas dimensions
        const x = nx * canvasWidth;
        const y = ny * canvasHeight;
        
        if (remoteStrokes.has(id)) {
            const stroke = remoteStrokes.get(id);
            stroke.points.push({ x, y });
        }
    });
    
    // Remote stroke end
    window.electronAPI.onRemoteStrokeEnd((data) => {
        const { id } = data;
        if (remoteStrokes.has(id)) {
            const stroke = remoteStrokes.get(id);
            stroke.isActive = false;
        }
    });
    
    // Clear overlay
    window.electronAPI.onClearOverlay(() => {
        remoteStrokes.clear();
        currentStrokeId = null;
        isDrawing = false;
    });
    
    // Bounds changed (window resize/move)
    window.electronAPI.onBoundsChanged((data) => {
        resizeCanvas();
    });
    
    // Screen dimensions received from main process (fallback)
    window.electronAPI.onScreenDimensions((data) => {
        if (data && data.width && data.height) {
            // Only use screen dimensions if video dimensions haven't been set yet
            if (!canvasWidth || !canvasHeight) {
                canvasWidth = data.width;
                canvasHeight = data.height;
                resizeCanvas();
            }
        }
    });
    
    // Video dimensions received from main window
    // These are the actual shared screen dimensions (videoWidth/videoHeight)
    // Use these for coordinate denormalization to ensure 1:1 pixel alignment
    // This is the correct reference for mapping viewer coordinates to the host screen
    window.electronAPI.onVideoDimensions((data) => {
        if (data && data.width && data.height) {
            canvasWidth = data.width;
            canvasHeight = data.height;
            resizeCanvas();
            console.log(`Overlay: Using video dimensions for coordinate mapping: ${canvasWidth}x${canvasHeight}`);
        }
    });
    
    // Overlay mode changed
    window.electronAPI.onOverlayModeChanged((mode) => {
        overlayMode = mode;
        canvas.style.cursor = overlayMode === 'draw' ? 'crosshair' : 'none';
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();
    
    // Get screen dimensions from main process to ensure accurate coordinate mapping
    // The overlay is fullscreen, so canvas should match screen dimensions exactly
    if (window.electronAPI) {
        try {
            const displayInfo = await window.electronAPI.getDisplayInfo();
            if (displayInfo && displayInfo.bounds) {
                // Set canvas to match screen dimensions exactly
                // This ensures 1:1 pixel mapping for annotations
                const screenWidth = displayInfo.bounds.width;
                const screenHeight = displayInfo.bounds.height;
                
                // Update canvas dimensions to match screen
                canvasWidth = screenWidth;
                canvasHeight = screenHeight;
                
                // Resize canvas with correct dimensions
                resizeCanvas();
            }
        } catch (err) {
            console.error('Error getting display info:', err);
            // Fallback to window dimensions
            resizeCanvas();
        }
    } else {
        resizeCanvas();
    }
    
    // Initialize trails system
    initTrails();
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});

