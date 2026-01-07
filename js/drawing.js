// Drawing Logic
import { state } from './state.js';
import { getMousePos, getCanvas, redrawCanvas, normalizeCoordinates } from './canvas.js';
import { setTool, confirmText, startText } from './tools.js';
import { sendToAllPeers } from './collaboration.js';
import { handleShapeStart, handleShapeMove, handleShapeEnd, isShapeTool } from './shapes/shapeHandlers.js';

let canvas = null;

export function initDrawing(canvasEl) {
    canvas = canvasEl;
}

// Check if coordinates are within the actual video content bounds when in screen mode
// Accounts for object-fit: contain which may add letterboxing/pillarboxing
function isWithinVideoBounds(clientX, clientY) {
    // If not in screen mode, allow drawing anywhere
    if (state.mode !== 'screen') {
        return true;
    }
    
    const videoElem = document.getElementById('screen-video');
    if (!videoElem || !videoElem.srcObject) {
        // No video active, allow drawing
        return true;
    }
    
    // Check if video is visible
    const computedStyle = window.getComputedStyle(videoElem);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || videoElem.offsetWidth === 0 || videoElem.offsetHeight === 0) {
        // Video not visible, allow drawing
        return true;
    }
    
    // Get video element's bounding rectangle
    const videoRect = videoElem.getBoundingClientRect();
    
    // Get video's intrinsic dimensions
    const videoWidth = videoElem.videoWidth;
    const videoHeight = videoElem.videoHeight;
    
    // If video dimensions aren't available yet, use element bounds as fallback
    if (!videoWidth || !videoHeight) {
        return (
            clientX >= videoRect.left &&
            clientX <= videoRect.right &&
            clientY >= videoRect.top &&
            clientY <= videoRect.bottom
        );
    }
    
    // Calculate aspect ratios
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = videoRect.width / videoRect.height;
    
    // Calculate actual video content bounds (accounting for object-fit: contain)
    let contentWidth, contentHeight, contentLeft, contentTop;
    
    if (videoAspect > containerAspect) {
        // Video is wider - letterboxing (black bars top/bottom)
        contentWidth = videoRect.width;
        contentHeight = videoRect.width / videoAspect;
        contentLeft = videoRect.left;
        contentTop = videoRect.top + (videoRect.height - contentHeight) / 2;
    } else {
        // Video is taller - pillarboxing (black bars left/right)
        contentHeight = videoRect.height;
        contentWidth = videoRect.height * videoAspect;
        contentTop = videoRect.top;
        contentLeft = videoRect.left + (videoRect.width - contentWidth) / 2;
    }
    
    // Check if coordinates are within the actual video content area
    return (
        clientX >= contentLeft &&
        clientX <= contentLeft + contentWidth &&
        clientY >= contentTop &&
        clientY <= contentTop + contentHeight
    );
}

export function handleStart(e) {
    if (!canvas) return;
    // Don't start drawing if clicking on controls inside canvas (unlikely with Z-index but safety first)
    // Note: Skip target check for touch events (synthetic MouseEvents don't have proper target)
    if (e.target && e.target !== canvas && e.type !== 'mousedown') return;

    // In screen mode, only allow drawing within video bounds
    if (!isWithinVideoBounds(e.clientX, e.clientY)) {
        return;
    }

    const { x, y } = getMousePos(e);

    if (state.tool === 'text') {
        if (state.textInput) {
            confirmText(); // Clicked elsewhere while typing
        } else {
            startText(x, y);
        }
        return;
    }

    // Handle shape tools
    if (isShapeTool(state.tool)) {
        state.isDrawing = true;
        handleShapeStart(x, y);
        return;
    }

    // If text input is open and we switch tools/click, confirm it first
    if (state.textInput) {
        const newElement = confirmText();
        if (newElement && state.isCollaborating) {
            // Generate ID for text element if not present
            if (!newElement.id) {
                newElement.id = `local-${Date.now()}-${Math.random()}`;
            }
            // Normalize coordinates for cross-resolution compatibility
            const normalizedElement = {
                ...newElement,
                start: normalizeCoordinates(newElement.start.x, newElement.start.y)
            };
            sendToAllPeers({
                type: 'ANNOTATION_ELEMENT',
                element: normalizedElement
            });
        }
        redrawCanvas();
    }

    state.isDrawing = true;

    // Generate unique ID for this element
    const elementId = `local-${Date.now()}-${Math.random()}`;
    const newElement = {
        id: elementId,
        type: state.tool,
        color: state.tool === 'eraser' ? '#000000' : state.color,
        width: state.strokeWidth,
        points: [{ x, y }],
        start: { x, y },
        end: { x, y },
        isActive: true
    };

    // Slice history for redo path
    state.elements = state.elements.slice(0, state.historyStep + 1);
    state.elements.push(newElement);
    state.historyStep++;

    // Send to all peers (normalize coordinates for cross-resolution compatibility)
    if (state.isCollaborating) {
        const normalized = normalizeCoordinates(x, y);
        sendToAllPeers({
            type: 'ANNOTATION_START',
            id: elementId,
            tool: state.tool,
            color: newElement.color,
            fillColor: newElement.fillColor,
            filled: newElement.filled,
            width: newElement.width,
            x: normalized.x,
            y: normalized.y
        });
    }

    redrawCanvas(); // Draw the initial point
}

export function handleMove(e) {
    if (!state.isDrawing) return;
    
    // In screen mode, stop drawing if outside video bounds
    if (!isWithinVideoBounds(e.clientX, e.clientY)) {
        // End the current stroke if we move outside video bounds
        if (state.isDrawing) {
            handleEnd(e);
        }
        return;
    }
    
    const { x, y } = getMousePos(e);
    
    // Handle shape tools
    if (isShapeTool(state.tool)) {
        handleShapeMove(x, y);
        return;
    }
    
    const currentElement = state.elements[state.historyStep];

    if (state.tool === 'pencil' || state.tool === 'eraser') {
        currentElement.points.push({ x, y });
    } else {
        currentElement.end = { x, y };
    }

    // Send to all peers (normalize coordinates for cross-resolution compatibility)
    if (state.isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        const normalized = normalizeCoordinates(x, y);
        sendToAllPeers({
            type: 'ANNOTATION_MOVE',
            id: currentElement ? currentElement.id : null,
            tool: state.tool,
            x: normalized.x,
            y: normalized.y
        });
    }

    redrawCanvas();
}

export function handleEnd(e) {
    // Handle shape tools
    if (isShapeTool(state.tool) && state.isDrawing) {
        handleShapeEnd();
        state.isDrawing = false;
        return;
    }
    
    if (state.isDrawing && state.isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        if (currentElement) {
            currentElement.isActive = false;
            sendToAllPeers({ 
                type: 'ANNOTATION_END',
                id: currentElement.id
            });
        } else {
            sendToAllPeers({ type: 'ANNOTATION_END' });
        }
    }
    state.isDrawing = false;
}

