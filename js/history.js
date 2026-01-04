// History Management
import { state } from './state.js';
import { redrawCanvas } from './canvas.js';
import { sendToPeer } from './collaboration.js';

export function undo() {
    if (state.historyStep >= 0) {
        state.historyStep--;
        redrawCanvas();
    }
}

export function redo() {
    if (state.historyStep < state.elements.length - 1) {
        state.historyStep++;
        redrawCanvas();
    }
}

export function clearCanvas() {
    state.elements = [];
    state.historyStep = -1;
    
    // Send to peer
    if (state.isCollaborating) {
        sendToPeer({ type: 'ANNOTATION_CLEAR' });
    }
    
    redrawCanvas();
}

