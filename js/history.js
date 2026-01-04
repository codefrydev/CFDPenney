// History Management
import { state } from './state.js';
import { redrawCanvas } from './canvas.js';
import { sendToAllPeers } from './collaboration.js';

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
    
    // Send to all peers
    if (state.isCollaborating) {
        sendToAllPeers({ type: 'ANNOTATION_CLEAR' });
    }
    
    redrawCanvas();
}

