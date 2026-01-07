// Main Entry Point for Penney (Infinite Canvas)
import { app } from '../theme.js';
import { initUI, updateUI } from './penneyUI.js';
import { closeCollaborationModal, handleHostSession, handleJoinSession } from '../modal.js';
import { getCodeFromURL, joinCollaborationWithCode } from '../collaboration.js';
import { state as penneyState } from './penneyState.js';
// Import regular state for collaboration modules (they import from '../state.js')
import { state as regularState } from '../state.js';
import '../popupModal.js'; // Initialize popup modal system
import '../mobile.js'; // Initialize mobile-specific features

// Sync penneyState properties to regularState for collaboration and selection compatibility
// This ensures collaboration modules and selection modules (which import from '../state.js') can work with penney
function syncStateForCollaboration() {
    // Sync all properties that selection and collaboration modules need
    regularState.elements = penneyState.elements;
    regularState.historyStep = penneyState.historyStep;
    regularState.selectedElementId = penneyState.selectedElementId;
    regularState.selectedElementIndex = penneyState.selectedElementIndex;
    regularState.selectedElementIds = penneyState.selectedElementIds;
    regularState.isResizing = penneyState.isResizing;
    regularState.isRotating = penneyState.isRotating;
    regularState.resizeHandle = penneyState.resizeHandle;
    regularState.isMultiSelecting = penneyState.isMultiSelecting;
    regularState.isDraggingSelection = penneyState.isDraggingSelection;
    regularState.selectionBoxStart = penneyState.selectionBoxStart;
    regularState.selectionBoxEnd = penneyState.selectionBoxEnd;
    regularState.selectionMode = penneyState.selectionMode;
    regularState.dragStartPoint = penneyState.dragStartPoint;
    regularState.tool = penneyState.tool;
    regularState.color = penneyState.color;
    regularState.strokeWidth = penneyState.strokeWidth;
    regularState.isDrawing = penneyState.isDrawing;
    regularState.textInput = penneyState.textInput;
    regularState.fillColor = penneyState.fillColor;
    regularState.filled = penneyState.filled;
    regularState.mode = penneyState.mode;
    
    // Sync collaboration-related properties
    // For peer property, use bidirectional sync to prevent overwriting non-null regularState.peer with null
    // If regularState.peer is set (by collaboration functions), sync it to penneyState.peer
    // Otherwise, sync from penneyState.peer to regularState.peer
    if (regularState.peer && !penneyState.peer) {
        // regularState.peer was set by collaboration functions, sync to penneyState
        penneyState.peer = regularState.peer;
    } else if (penneyState.peer) {
        // penneyState.peer exists, sync to regularState
        regularState.peer = penneyState.peer;
    }
    // If both are null, no sync needed
    
    regularState.dataConnections = penneyState.dataConnections;
    regularState.connectedPeers = penneyState.connectedPeers;
    regularState.isCollaborating = penneyState.isCollaborating;
    regularState.isHosting = penneyState.isHosting;
    regularState.shareCode = penneyState.shareCode;
    regularState.peerElements = penneyState.peerElements;
    regularState.myPeerId = penneyState.myPeerId;
    regularState.calls = penneyState.calls;
    regularState.cameraCalls = penneyState.cameraCalls;
}

// Sync penneyState to regularState (needed before selection operations)
// Selection modules read from regularState, so we need to sync before they access it
export function syncPenneyStateToRegular() {
    console.log('[penneyMain] syncPenneyStateToRegular - penneyState.elements.length:', penneyState.elements.length, 'regularState.elements.length:', regularState.elements.length);
    // Sync all properties that selection and collaboration modules need
    regularState.elements = penneyState.elements;
    regularState.historyStep = penneyState.historyStep;
    console.log('[penneyMain] syncPenneyStateToRegular - after sync, regularState.elements.length:', regularState.elements.length);
    regularState.selectedElementId = penneyState.selectedElementId;
    regularState.selectedElementIndex = penneyState.selectedElementIndex;
    regularState.selectedElementIds = penneyState.selectedElementIds;
    regularState.isResizing = penneyState.isResizing;
    regularState.isRotating = penneyState.isRotating;
    regularState.resizeHandle = penneyState.resizeHandle;
    regularState.isMultiSelecting = penneyState.isMultiSelecting;
    regularState.isDraggingSelection = penneyState.isDraggingSelection;
    regularState.selectionBoxStart = penneyState.selectionBoxStart;
    regularState.selectionBoxEnd = penneyState.selectionBoxEnd;
    regularState.selectionMode = penneyState.selectionMode;
    regularState.dragStartPoint = penneyState.dragStartPoint;
    regularState.tool = penneyState.tool;
    regularState.color = penneyState.color;
    regularState.strokeWidth = penneyState.strokeWidth;
    regularState.isDrawing = penneyState.isDrawing;
    regularState.textInput = penneyState.textInput;
    regularState.fillColor = penneyState.fillColor;
    regularState.filled = penneyState.filled;
    regularState.mode = penneyState.mode;
}

// Sync regularState properties back to penneyState
// This is needed because shape handlers and selection modules write to regularState
// but penneyCanvas reads from penneyState
export function syncRegularStateToPenney() {
    console.log('[penneyMain] syncRegularStateToPenney - regularState.elements.length:', regularState.elements.length, 'penneyState.elements.length:', penneyState.elements.length);
    console.log('[penneyMain] syncRegularStateToPenney - regularState.historyStep:', regularState.historyStep, 'penneyState.historyStep:', penneyState.historyStep);
    
    // Sync elements and history (critical for shapes to appear)
    if (regularState.elements !== penneyState.elements) {
        console.log('[penneyMain] syncRegularStateToPenney - SYNCING ELEMENTS ARRAY');
        penneyState.elements = regularState.elements;
    }
    if (regularState.historyStep !== penneyState.historyStep) {
        console.log('[penneyMain] syncRegularStateToPenney - SYNCING historyStep');
        penneyState.historyStep = regularState.historyStep;
    }
    
    // Sync selection-related properties
    penneyState.selectedElementId = regularState.selectedElementId;
    penneyState.selectedElementIndex = regularState.selectedElementIndex;
    if (regularState.selectedElementIds !== penneyState.selectedElementIds) {
        penneyState.selectedElementIds = [...regularState.selectedElementIds];
    }
    penneyState.isResizing = regularState.isResizing;
    penneyState.isRotating = regularState.isRotating;
    penneyState.resizeHandle = regularState.resizeHandle;
    penneyState.isMultiSelecting = regularState.isMultiSelecting;
    penneyState.isDraggingSelection = regularState.isDraggingSelection;
    penneyState.selectionBoxStart = regularState.selectionBoxStart;
    penneyState.selectionBoxEnd = regularState.selectionBoxEnd;
    penneyState.selectionMode = regularState.selectionMode;
    penneyState.dragStartPoint = regularState.dragStartPoint;
    
    // Sync tool-related properties (in case tools.js modifies them)
    penneyState.tool = regularState.tool;
    penneyState.color = regularState.color;
    penneyState.strokeWidth = regularState.strokeWidth;
    penneyState.isDrawing = regularState.isDrawing;
    penneyState.textInput = regularState.textInput;
    penneyState.fillColor = regularState.fillColor;
    penneyState.filled = regularState.filled;
}

// Use penneyState as the main state
const state = penneyState;

// Initialize app
function init() {
    // Sync state for collaboration before initializing
    syncStateForCollaboration();
    
    // Set up periodic sync to keep states in sync
    setInterval(syncStateForCollaboration, 100);
    
    initUI();
    if (window.lucide) {
        lucide.createIcons();
    }
    app.initTheme();
    
    // Check for code in URL and auto-join if valid
    const urlCode = getCodeFromURL();
    if (urlCode && urlCode.length === 5) {
        // Wait a bit for UI to be fully initialized, then auto-join
        setTimeout(() => {
            // Only auto-join if not already collaborating
            if (!state.isCollaborating) {
                // Auto-fill the join input for visual feedback
                const joinInput = document.getElementById('join-code-input');
                if (joinInput) {
                    joinInput.value = urlCode;
                }
                // Automatically join the session
                joinCollaborationWithCode(urlCode);
            }
        }, 500);
    }
}

// Make app available globally for inline event handlers
window.app = app;

// Make modal functions globally available
window.closeCollaborationModal = closeCollaborationModal;
window.handleHostSession = handleHostSession;
window.handleJoinSession = handleJoinSession;

// Make sync function available globally for shapePicker
window.syncRegularStateToPenney = syncRegularStateToPenney;

// Start App
init();

