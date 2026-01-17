// UI Management for Penney (Infinite Canvas)
import { state } from './penneyState.js';
import { resizeCanvas, redrawCanvas, initCanvas, getMousePos, zoomViewport, panViewport, resetViewport } from './penneyCanvas.js';
// Import regular canvas.js for selection modules compatibility
import * as regularCanvas from '../canvas.js';
import { renderTools, renderColors, setTool, setColor, setFillColor, toggleFill, confirmText, initTools, updateTextInputStyle } from '../tools.js';
import { TOOLS } from '../config.js';
import { handleStart, handleMove, handleEnd, initDrawing } from './penneyDrawing.js';
import { undo, redo, clearCanvas } from '../history.js';
import { showAlert } from '../popupModal.js';
import { downloadSnapshot, initExport } from '../export.js';
import { stopCollaboration, sendToAllPeers } from '../collaboration.js';
import { showCollaborationModal } from '../modal.js';
import { selectElementAtPoint, clearSelection, getElementsInBox, getSelectedElements } from '../selection/selectionCore.js';
import { getHandleAtPoint } from '../selection/selectionUI.js';
import { startMove, moveElement, endMove, startResize, resizeElement, endResize, startRotate, rotateElement, endRotate, deleteElement, nudgeElement, startMoveMultiple, moveMultipleElements, endMoveMultiple } from '../selection/manipulation.js';
import { initStickerPicker } from '../stickers/stickerPicker.js';
import { initShapePicker } from '../shapes/shapePicker.js';
import { createGroup, ungroupElement, isGroup } from '../selection/grouping.js';
import { resetSelectionBoxAnimation } from '../selection/selectionUI.js';
import { getBoundingBox } from '../shapes/shapeUtils.js';
import { syncRegularStateToPenney, syncPenneyStateToRegular } from './penneyMain.js';
import { state as regularState } from '../state.js';

// Make updateUI available globally for collaboration module
window.updateUI = null;

let canvas = null;
let container = null;
let toolContainer = null;
let colorContainer = null;
let textInputElem = null;
let strokeSlider = null;
let strokeIndicator = null;
let mobileStrokeSlider = null;
let mobileStrokeIndicator = null;
let zoomIndicator = null;

/**
 * Update zoom indicator
 */
function updateZoomIndicator() {
    if (zoomIndicator) {
        zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
    }
}

/**
 * Handle pan start
 */
function handlePanStart(e) {
    if (state.tool === 'select' || state.isDrawing) return;
    
    // Check if middle mouse button or spacebar + left click
    const isMiddleButton = e.button === 1;
    const isSpacePressed = e.spaceKey || (e.type === 'mousedown' && e.button === 0 && state.spaceKeyPressed);
    
    if (isMiddleButton || isSpacePressed) {
        e.preventDefault();
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.panStartViewportX = state.viewportX;
        state.panStartViewportY = state.viewportY;
        canvas.style.cursor = 'grabbing';
    }
}

/**
 * Handle pan move
 */
function handlePanMove(e) {
    if (!state.isPanning) return;
    
    e.preventDefault();
    const deltaX = (e.clientX - state.panStartX) / state.zoom;
    const deltaY = (e.clientY - state.panStartY) / state.zoom;
    
    // Move viewport in the same direction as mouse (canvas follows mouse)
    state.viewportX = state.panStartViewportX + deltaX;
    state.viewportY = state.panStartViewportY + deltaY;
    
    redrawCanvas();
}

/**
 * Handle pan end
 */
function handlePanEnd(e) {
    if (state.isPanning) {
        state.isPanning = false;
        canvas.style.cursor = '';
    }
}

/**
 * Handle zoom (mouse wheel)
 */
function handleZoom(e) {
    if (state.tool === 'select' && state.isDraggingSelection) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomViewport(delta, e.clientX, e.clientY);
    updateZoomIndicator();
}

/**
 * Handle touch pan
 */
function handleTouchPan(e) {
    if (e.touches.length !== 1 || state.tool === 'select' || state.isDrawing) return;
    
    const touch = e.touches[0];
    if (!state.isPanning) {
        state.isPanning = true;
        state.panStartX = touch.clientX;
        state.panStartY = touch.clientY;
        state.panStartViewportX = state.viewportX;
        state.panStartViewportY = state.viewportY;
    } else {
        const deltaX = (touch.clientX - state.panStartX) / state.zoom;
        const deltaY = (touch.clientY - state.panStartY) / state.zoom;
        
        // Move viewport in the same direction as touch (canvas follows touch)
        state.viewportX = state.panStartViewportX + deltaX;
        state.viewportY = state.panStartViewportY + deltaY;
        
        redrawCanvas();
    }
}

/**
 * Handle touch zoom (pinch)
 */
let lastTouchDistance = 0;
function handleTouchZoom(e) {
    if (e.touches.length !== 2) {
        lastTouchDistance = 0;
        return;
    }
    
    e.preventDefault();
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    
    if (lastTouchDistance > 0) {
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const zoomDelta = distance / lastTouchDistance;
        zoomViewport(zoomDelta, centerX, centerY);
        updateZoomIndicator();
    }
    
    lastTouchDistance = distance;
}

export function initUI() {
    // Get DOM elements
    canvas = document.getElementById('main-canvas');
    container = document.getElementById('workspace-container');
    toolContainer = document.getElementById('tool-container');
    colorContainer = document.getElementById('color-container');
    textInputElem = document.getElementById('text-tool-input');
    strokeSlider = document.getElementById('stroke-slider');
    strokeIndicator = document.getElementById('stroke-indicator');
    mobileStrokeSlider = document.getElementById('mobile-stroke-slider');
    mobileStrokeIndicator = document.getElementById('mobile-stroke-indicator');
    zoomIndicator = document.getElementById('zoom-indicator');
    
    // Initialize modules with DOM elements
    if (canvas && container) {
        // Initialize penney canvas
        initCanvas(canvas, container);
        
        // Also initialize regular canvas.js for selection modules compatibility
        // Selection modules import getCtx from '../canvas.js', so we need to initialize that too
        if (regularCanvas && typeof regularCanvas.initCanvas === 'function') {
            regularCanvas.initCanvas(canvas, container);
        }
    }
    
    if (toolContainer && colorContainer && textInputElem) {
        initTools(toolContainer, colorContainer, textInputElem);
    }
    
    if (canvas) {
        initDrawing(canvas);
    }
    
    // Initialize export (no video element needed for infinite canvas)
    initExport(null);
    
    // Initialize sticker picker
    initStickerPicker();
    
    // Initialize shape picker
    initShapePicker();
    
    // Render initial UI
    renderTools();
    renderColors();
    setupEventListeners();
    resizeCanvas();
    updateUI(); // This will set window.updateUI
    updateZoomIndicator();
}

export function updateUI() {
    // Store reference globally for collaboration module
    window.updateUI = updateUI;
    
    // Update Tool Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        const toolId = btn.dataset.tool;
        const isShapeTool = toolId === 'shapes' && ['line', 'arrow', 'rect', 'circle', 'ellipse', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'octagon'].includes(state.tool);
        const isActive = toolId === state.tool || isShapeTool;
        
        if (isActive) {
            btn.className = 'annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200 annotate-tool-btn-active shadow-lg scale-105';
        } else {
            btn.className = 'annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200';
        }
    });

    // Update Color Buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        if (btn.dataset.color === state.color) {
            btn.classList.add('border-white', 'scale-110');
            btn.classList.remove('border-transparent');
        } else {
            btn.classList.remove('border-white', 'scale-110');
            btn.classList.add('border-transparent');
        }
    });

    // Update Fill Controls visibility
    const fillControls = document.getElementById('fill-controls');
    if (fillControls) {
        const currentTool = TOOLS.find(t => t.id === state.tool);
        const shouldShow = currentTool && currentTool.fillable;
        fillControls.classList.toggle('hidden', !shouldShow);
        
        // Update fill toggle state
        const fillToggle = document.getElementById('fill-toggle');
        if (fillToggle) {
            fillToggle.classList.toggle('bg-indigo-600', state.filled);
        }
    }

    // Undo/Redo State
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const mobileBtnUndo = document.getElementById('mobile-btn-undo');
    const mobileBtnRedo = document.getElementById('mobile-btn-redo');
    if (btnUndo) btnUndo.disabled = state.historyStep < 0;
    if (btnRedo) btnRedo.disabled = state.historyStep >= state.elements.length - 1;
    if (mobileBtnUndo) mobileBtnUndo.disabled = state.historyStep < 0;
    if (mobileBtnRedo) mobileBtnRedo.disabled = state.historyStep >= state.elements.length - 1;
}

function setupEventListeners() {
    // Track spacebar for pan
    let spaceKeyPressed = false;
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            spaceKeyPressed = true;
            state.spaceKeyPressed = true;
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            spaceKeyPressed = false;
            state.spaceKeyPressed = false;
        }
    });
    
    // Resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        redrawCanvas();
    });

    if (!canvas) return;

    // Pan handlers
    canvas.addEventListener('mousedown', (e) => {
        handlePanStart(e);
        if (!state.isPanning) {
            if (state.tool === 'select') {
                handleSelectionStart(e);
            } else {
                handleStart(e);
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (state.isPanning) {
            handlePanMove(e);
        } else if (state.tool === 'select') {
            handleSelectionMove(e);
        } else {
            handleMove(e);
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        handlePanEnd(e);
        if (state.tool === 'select') {
            handleSelectionEnd(e);
        } else {
            handleEnd(e);
        }
    });
    
    canvas.addEventListener('mouseleave', (e) => {
        handlePanEnd(e);
        if (state.tool === 'select') {
            handleSelectionEnd(e);
        } else {
            handleEnd(e);
        }
    });
    
    // Prevent context menu on middle click
    canvas.addEventListener('contextmenu', (e) => {
        if (e.button === 1) {
            e.preventDefault();
        }
    });
    
    // Zoom handler
    canvas.addEventListener('wheel', handleZoom, { passive: false });
    
    // Touch handlers
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            if (state.tool === 'select') {
                handleSelectionStart(mouseEvent);
            } else {
                handleStart(mouseEvent);
            }
        } else if (e.touches.length === 2) {
            e.preventDefault();
            handleTouchZoom(e);
        }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            handleTouchPan(e);
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                bubbles: true
            });
            if (!state.isPanning) {
                if (state.tool === 'select') {
                    handleSelectionMove(mouseEvent);
                } else {
                    handleMove(mouseEvent);
                }
            }
        } else if (e.touches.length === 2) {
            e.preventDefault();
            handleTouchZoom(e);
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            state.isPanning = false;
            lastTouchDistance = 0;
            const mouseEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            if (state.tool === 'select') {
                handleSelectionEnd(mouseEvent);
            } else {
                handleEnd(mouseEvent);
            }
        }
    }, { passive: false });

    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const toolId = btn.dataset.tool;
            setTool(toolId);
            // Sync tool from regularState to penneyState
            syncPenneyStateToRegular();
            syncRegularStateToPenney();
            updateUI();
        });
    });

    // Color selection
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setColor(btn.dataset.color);
            updateUI();
        });
    });

    // Custom color picker
    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.addEventListener('change', (e) => {
            setColor(e.target.value);
            updateUI();
        });
    }

    // Fill color picker
    const fillColorPicker = document.getElementById('fill-color-picker');
    if (fillColorPicker) {
        fillColorPicker.addEventListener('change', (e) => {
            setFillColor(e.target.value);
            updateUI();
        });
    }

    // Fill toggle
    const fillToggle = document.getElementById('fill-toggle');
    if (fillToggle) {
        fillToggle.addEventListener('click', () => {
            toggleFill();
            updateUI();
        });
    }

    // Stroke width slider
    if (strokeSlider) {
        strokeSlider.addEventListener('input', (e) => {
            state.strokeWidth = parseInt(e.target.value);
            if (strokeIndicator) {
                strokeIndicator.style.width = `${state.strokeWidth}px`;
                strokeIndicator.style.height = `${state.strokeWidth}px`;
            }
            updateTextInputStyle();
        });
    }

    // Trail Duration Slider
    const trailSlider = document.getElementById('trail-slider');
    const trailDurationValue = document.getElementById('trail-duration-value');
    if (trailSlider && trailDurationValue) {
        trailSlider.addEventListener('input', (e) => {
            state.trailFadeDuration = parseInt(e.target.value);
            trailDurationValue.textContent = `${(state.trailFadeDuration / 1000).toFixed(1)}s`;
        });
    }
    
    // Trail Type Buttons
    const trailTypeButtons = document.querySelectorAll('.trail-type-btn');
    function updateTrailTypeButtons() {
        trailTypeButtons.forEach(btn => {
            if (btn.dataset.type === state.trailType) {
                btn.classList.add('bg-indigo-600', 'text-white');
                btn.classList.remove('bg-tertiary', 'text-secondary');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-tertiary', 'text-secondary');
            }
        });
    }
    trailTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            state.trailType = btn.dataset.type;
            updateTrailTypeButtons();
        });
    });
    updateTrailTypeButtons();

    // Mobile stroke width slider
    if (mobileStrokeSlider) {
        mobileStrokeSlider.addEventListener('input', (e) => {
            state.strokeWidth = parseInt(e.target.value);
            if (mobileStrokeIndicator) {
                mobileStrokeIndicator.style.width = `${state.strokeWidth}px`;
                mobileStrokeIndicator.style.height = `${state.strokeWidth}px`;
            }
            updateTextInputStyle();
        });
    }

    // Undo/Redo
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const mobileBtnUndo = document.getElementById('mobile-btn-undo');
    const mobileBtnRedo = document.getElementById('mobile-btn-redo');
    
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);
    if (mobileBtnUndo) mobileBtnUndo.addEventListener('click', undo);
    if (mobileBtnRedo) mobileBtnRedo.addEventListener('click', redo);

    // Snapshot
    const btnSnapshot = document.getElementById('btn-snapshot');
    const mobileBtnSnapshot = document.getElementById('mobile-btn-snapshot');
    if (btnSnapshot) btnSnapshot.addEventListener('click', downloadSnapshot);
    if (mobileBtnSnapshot) mobileBtnSnapshot.addEventListener('click', downloadSnapshot);

    // Clear
    const btnClear = document.getElementById('btn-clear');
    const mobileBtnClear = document.getElementById('mobile-btn-clear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm('Clear all drawings?')) {
                clearCanvas();
                updateUI();
            }
        });
    }
    if (mobileBtnClear) {
        mobileBtnClear.addEventListener('click', () => {
            if (confirm('Clear all drawings?')) {
                clearCanvas();
                updateUI();
            }
        });
    }

    // Reset view
    const btnResetView = document.getElementById('btn-reset-view');
    if (btnResetView) {
        btnResetView.addEventListener('click', () => {
            resetViewport();
            updateZoomIndicator();
        });
    }

    // Collaboration
    const btnCollaborate = document.getElementById('btn-collaborate');
    if (btnCollaborate) {
        btnCollaborate.addEventListener('click', () => {
            if (state.isCollaborating) {
                stopCollaboration();
            } else {
                showCollaborationModal();
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in input fields
        if (e.target.matches('input, textarea')) return;
        
        // Undo: Ctrl+Z or Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            updateUI();
        }
        // Redo: Ctrl+Shift+Z or Cmd+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            redo();
            updateUI();
        }
        // Delete selected elements
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedElementIds.length > 0) {
                e.preventDefault();
                state.selectedElementIds.forEach(id => {
                    const index = state.elements.findIndex(el => el.id === id);
                    if (index !== -1) {
                        deleteElement(index);
                    }
                });
                clearSelection();
                redrawCanvas();
                updateUI();
            }
        }
    });
}

// Selection handlers (simplified versions)
function handleSelectionStart(e) {
    // Sync penneyState → regularState before selection operations
    // Selection modules read from regularState, so we need latest elements
    syncPenneyStateToRegular();
    
    const { x, y } = getMousePos(e);
    const handle = getHandleAtPoint(x, y);
    
    if (handle) {
        if (handle.type === 'resize') {
            startResize(handle);
            // Sync selection state from regularState to penneyState
            syncRegularStateToPenney();
        } else if (handle.type === 'rotate') {
            startRotate(x, y);
            // Sync selection state from regularState to penneyState
            syncRegularStateToPenney();
        }
    } else {
        const element = selectElementAtPoint(x, y);
        if (element) {
            // selectElementAtPoint writes to regularState, sync to penneyState
            syncRegularStateToPenney();
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                // Multi-select
                const index = state.selectedElementIds.indexOf(element.id);
                if (index === -1) {
                    state.selectedElementIds.push(element.id);
                } else {
                    state.selectedElementIds.splice(index, 1);
                }
            } else {
                // Single select
                state.selectedElementIds = [element.id];
            }
            redrawCanvas();
        } else {
            // Start drag selection
            clearSelection();
            // clearSelection writes to regularState, sync to penneyState
            syncRegularStateToPenney();
            state.isMultiSelecting = true;
            state.selectionBoxStart = { x, y };
            state.selectionBoxEnd = { x, y };
        }
    }
}

function handleSelectionMove(e) {
    const { x, y } = getMousePos(e);
    
    if (state.isResizing) {
        resizeElement(x, y);
        // resizeElement writes to regularState, sync to penneyState
        syncRegularStateToPenney();
        redrawCanvas();
    } else if (state.isRotating) {
        rotateElement(x, y);
        // rotateElement writes to regularState, sync to penneyState
        syncRegularStateToPenney();
        redrawCanvas();
    } else if (state.isMultiSelecting) {
        state.selectionBoxEnd = { x, y };
        redrawCanvas();
    } else if (state.selectedElementIds.length > 0) {
        if (!state.isDraggingSelection) {
            state.isDraggingSelection = true;
            const firstElement = state.elements.find(el => el.id === state.selectedElementIds[0]);
            if (firstElement) {
                startMoveMultiple({ x, y });
                // startMoveMultiple writes to regularState, sync to penneyState
                syncRegularStateToPenney();
            }
        } else {
            moveMultipleElements({ x, y });
            // moveMultipleElements writes to regularState, sync to penneyState
            syncRegularStateToPenney();
            redrawCanvas();
        }
    }
}

function handleSelectionEnd(e) {
    if (state.isResizing) {
        endResize();
        // endResize writes to regularState, sync to penneyState
        syncRegularStateToPenney();
        redrawCanvas();
    } else if (state.isRotating) {
        endRotate();
        // endRotate writes to regularState, sync to penneyState
        syncRegularStateToPenney();
        redrawCanvas();
    } else if (state.isMultiSelecting) {
        const elements = getElementsInBox(state.selectionBoxStart, state.selectionBoxEnd);
        state.selectedElementIds = elements.map(el => el.id);
        state.isMultiSelecting = false;
        state.selectionBoxStart = null;
        state.selectionBoxEnd = null;
        redrawCanvas();
    } else if (state.isDraggingSelection) {
        endMoveMultiple();
        // endMoveMultiple writes to regularState, sync to penneyState
        syncRegularStateToPenney();
        state.isDraggingSelection = false;
        redrawCanvas();
    }
}

