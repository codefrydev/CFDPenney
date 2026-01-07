// Drawing Logic for Infinite Canvas
import { state } from './penneyState.js';
import { getMousePos, getCanvas, redrawCanvas, normalizeCoordinates } from './penneyCanvas.js';
import { setTool, confirmText, startText } from '../tools.js';
import { sendToAllPeers } from '../collaboration.js';
import { handleShapeStart, handleShapeMove, handleShapeEnd, isShapeTool } from '../shapes/shapeHandlers.js';
import { syncRegularStateToPenney, syncPenneyStateToRegular } from './penneyMain.js';
import { state as regularState } from '../state.js';

let canvas = null;

export function initDrawing(canvasEl) {
    canvas = canvasEl;
}

export function handleStart(e) {
    console.log('[penneyDrawing] handleStart - tool:', state.tool, 'isShapeTool:', isShapeTool(state.tool));
    if (!canvas) {
        console.log('[penneyDrawing] handleStart - no canvas!');
        return;
    }
    // Don't start drawing if clicking on controls inside canvas
    // Note: Skip target check for touch events (synthetic MouseEvents don't have proper target)
    if (e.target && e.target !== canvas && e.type !== 'mousedown') {
        console.log('[penneyDrawing] handleStart - target is not canvas:', e.target);
        return;
    }

    const { x, y } = getMousePos(e);
    console.log('[penneyDrawing] handleStart - mouse pos:', { x, y });

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
        console.log('[penneyDrawing] handleStart - SHAPE TOOL DETECTED:', state.tool);
        // Sync penneyState → regularState first so handleShapeStart has correct state
        syncPenneyStateToRegular();
        // Set isDrawing in both states
        state.isDrawing = true;
        regularState.isDrawing = true;
        console.log('[penneyDrawing] handleStart - calling handleShapeStart, regularState.elements.length:', regularState.elements.length, 'penneyState.elements.length:', state.elements.length);
        handleShapeStart(x, y);
        console.log('[penneyDrawing] handleStart - after handleShapeStart, regularState.elements.length:', regularState.elements.length, 'penneyState.elements.length:', state.elements.length);
        // Immediately sync regularState → penneyState so shape appears on canvas
        syncRegularStateToPenney();
        console.log('[penneyDrawing] handleStart - after sync, penneyState.elements.length:', state.elements.length, 'isDrawing:', state.isDrawing);
        redrawCanvas();
        return;
    }

    // If text input is open and we switch tools/click, confirm it first
    if (state.textInput) {
        const newElement = confirmText();
        // Check both states - regularState is set by collaboration modules, penneyState is synced
        const isCollaborating = state.isCollaborating || regularState.isCollaborating;
        if (newElement && isCollaborating) {
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
    // Check both states - regularState is set by collaboration modules, penneyState is synced
    const isCollaborating = state.isCollaborating || regularState.isCollaborating;
    console.log('[penneyDrawing] handleStart - isCollaborating:', state.isCollaborating, 'regularState.isCollaborating:', regularState.isCollaborating, 'using:', isCollaborating, 'elementId:', elementId);
    if (isCollaborating) {
        const normalized = normalizeCoordinates(x, y);
        console.log('[penneyDrawing] handleStart - sending ANNOTATION_START, normalized coords:', normalized.x, normalized.y, 'tool:', state.tool);
        const sentCount = sendToAllPeers({
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
        console.log('[penneyDrawing] handleStart - sent to', sentCount, 'peers');
    } else {
        console.log('[penneyDrawing] handleStart - NOT collaborating, not sending message');
    }

    redrawCanvas(); // Draw the initial point
}

export function handleMove(e) {
    if (!state.isDrawing) {
        console.log('[penneyDrawing] handleMove - not drawing, isDrawing:', state.isDrawing);
        return;
    }
    const { x, y } = getMousePos(e);
    
    // Handle shape tools
    if (isShapeTool(state.tool)) {
        console.log('[penneyDrawing] handleMove - shape tool move:', state.tool);
        // Ensure regularState.isDrawing is also true
        if (!regularState.isDrawing) {
            regularState.isDrawing = true;
        }
        handleShapeMove(x, y);
        // Immediately sync regularState → penneyState so shape updates appear on canvas
        syncRegularStateToPenney();
        redrawCanvas();
        return;
    }
    
    const currentElement = state.elements[state.historyStep];

    if (state.tool === 'pencil' || state.tool === 'eraser') {
        currentElement.points.push({ x, y });
    } else {
        currentElement.end = { x, y };
    }

    // Send to all peers (normalize coordinates for cross-resolution compatibility)
    // Check both states - regularState is set by collaboration modules, penneyState is synced
    const isCollaborating = state.isCollaborating || regularState.isCollaborating;
    if (isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        const normalized = normalizeCoordinates(x, y);
        const sentCount = sendToAllPeers({
            type: 'ANNOTATION_MOVE',
            id: currentElement ? currentElement.id : null,
            tool: state.tool,
            x: normalized.x,
            y: normalized.y
        });
        console.log('[penneyDrawing] handleMove - sent ANNOTATION_MOVE to', sentCount, 'peers, coords:', normalized.x, normalized.y);
    }

    redrawCanvas();
}

export function handleEnd(e) {
    // Handle shape tools
    if (isShapeTool(state.tool) && state.isDrawing) {
        console.log('[penneyDrawing] handleEnd - shape tool end:', state.tool);
        // Ensure regularState.isDrawing is true before calling handleShapeEnd
        if (!regularState.isDrawing) {
            regularState.isDrawing = true;
        }
        handleShapeEnd();
        // Immediately sync regularState → penneyState so final shape appears on canvas
        syncRegularStateToPenney();
        console.log('[penneyDrawing] handleEnd - after sync, penneyState.elements.length:', state.elements.length);
        // Reset isDrawing in both states
        state.isDrawing = false;
        regularState.isDrawing = false;
        console.log('[penneyDrawing] handleEnd - isDrawing reset to false');
        redrawCanvas();
        return;
    }
    
    // Check both states - regularState is set by collaboration modules, penneyState is synced
    const isCollaborating = state.isCollaborating || regularState.isCollaborating;
    if (state.isDrawing && isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        if (currentElement) {
            currentElement.isActive = false;
            const sentCount = sendToAllPeers({ 
                type: 'ANNOTATION_END',
                id: currentElement.id
            });
            console.log('[penneyDrawing] handleEnd - sent ANNOTATION_END to', sentCount, 'peers, elementId:', currentElement.id);
        } else {
            const sentCount = sendToAllPeers({ type: 'ANNOTATION_END' });
            console.log('[penneyDrawing] handleEnd - sent ANNOTATION_END to', sentCount, 'peers (no element)');
        }
    } else {
        console.log('[penneyDrawing] handleEnd - NOT sending (isDrawing:', state.isDrawing, 'penneyIsCollaborating:', state.isCollaborating, 'regularIsCollaborating:', regularState.isCollaborating, 'using:', isCollaborating, ')');
    }
    // Reset isDrawing in both states
    state.isDrawing = false;
    regularState.isDrawing = false;
    console.log('[penneyDrawing] handleEnd - isDrawing reset to false (non-shape)');
}

