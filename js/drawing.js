// Drawing Logic
import { state } from './state.js';
import { getMousePos, getCanvas, redrawCanvas } from './canvas.js';
import { setTool, confirmText, startText } from './tools.js';
import { sendToPeer } from './collaboration.js';

let canvas = null;

export function initDrawing(canvasEl) {
    canvas = canvasEl;
}

export function handleStart(e) {
    if (!canvas) return;
    // Don't start drawing if clicking on controls inside canvas (unlikely with Z-index but safety first)
    if (e.target !== canvas) return;

    const { x, y } = getMousePos(e);

    if (state.tool === 'text') {
        if (state.textInput) {
            confirmText(); // Clicked elsewhere while typing
        } else {
            startText(x, y);
        }
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
            sendToPeer({
                type: 'ANNOTATION_ELEMENT',
                element: newElement
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

    // Send to peer
    if (state.isCollaborating) {
        sendToPeer({
            type: 'ANNOTATION_START',
            id: elementId,
            tool: state.tool,
            color: newElement.color,
            width: newElement.width,
            x: x,
            y: y
        });
    }

    redrawCanvas(); // Draw the initial point
}

export function handleMove(e) {
    if (!state.isDrawing) return;
    const { x, y } = getMousePos(e);
    const currentElement = state.elements[state.historyStep];

    if (state.tool === 'pencil' || state.tool === 'eraser') {
        currentElement.points.push({ x, y });
    } else {
        currentElement.end = { x, y };
    }

    // Send to peer
    if (state.isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        sendToPeer({
            type: 'ANNOTATION_MOVE',
            id: currentElement ? currentElement.id : null,
            tool: state.tool,
            x: x,
            y: y
        });
    }

    redrawCanvas();
}

export function handleEnd(e) {
    if (state.isDrawing && state.isCollaborating) {
        const currentElement = state.elements[state.historyStep];
        if (currentElement) {
            currentElement.isActive = false;
            sendToPeer({ 
                type: 'ANNOTATION_END',
                id: currentElement.id
            });
        } else {
            sendToPeer({ type: 'ANNOTATION_END' });
        }
    }
    state.isDrawing = false;
}

