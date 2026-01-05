// UI Management
import { state } from './state.js';
import { resizeCanvas, redrawCanvas, initCanvas, normalizeCoordinates, getMousePos } from './canvas.js';
import { renderTools, renderColors, setTool, setColor, setFillColor, toggleFill, confirmText, initTools, updateTextInputStyle } from './tools.js';
import { TOOLS } from './config.js';
import { handleStart, handleMove, handleEnd, initDrawing } from './drawing.js';
import { undo, redo, clearCanvas } from './history.js';
import { startScreenShare, stopScreenShare, toggleVideoPause, setMode, initScreenShare } from './screenShare.js';
import { handleImageUpload, initImageUpload } from './imageUpload.js';
import { downloadSnapshot, initExport } from './export.js';
import { stopCollaboration, sendToAllPeers, sendToPeer } from './collaboration.js';
import { showCollaborationModal } from './modal.js';
import { selectElementAtPoint, clearSelection, getElementsInBox } from './selection/selectionCore.js';
import { getHandleAtPoint } from './selection/selectionUI.js';
import { startMove, moveElement, endMove, startResize, resizeElement, endResize, startRotate, rotateElement, endRotate, deleteElement, nudgeElement } from './selection/manipulation.js';
import { initStickerPicker } from './stickers/stickerPicker.js';
import { initShapePicker } from './shapes/shapePicker.js';
import { createGroup, ungroupElement, isGroup } from './selection/grouping.js';

// Make updateUI available globally for collaboration module
window.updateUI = null;

let canvas = null;
let container = null;
let toolContainer = null;
let colorContainer = null;
let textInputElem = null;
let strokeSlider = null;
let strokeIndicator = null;

export function initUI() {
    // Get DOM elements
    canvas = document.getElementById('main-canvas');
    container = document.getElementById('workspace-container');
    toolContainer = document.getElementById('tool-container');
    colorContainer = document.getElementById('color-container');
    textInputElem = document.getElementById('text-tool-input');
    strokeSlider = document.getElementById('stroke-slider');
    strokeIndicator = document.getElementById('stroke-indicator');
    
    // Initialize modules with DOM elements
    if (canvas && container) {
        initCanvas(canvas, container);
    }
    
    if (toolContainer && colorContainer && textInputElem) {
        initTools(toolContainer, colorContainer, textInputElem);
    }
    
    if (canvas) {
        initDrawing(canvas);
    }
    
    // Initialize screen share
    const videoElem = document.getElementById('screen-video');
    const videoPlaceholder = document.getElementById('screen-placeholder');
    const videoControls = document.getElementById('screen-controls');
    if (videoElem && videoPlaceholder && videoControls) {
        initScreenShare(videoElem, videoPlaceholder, videoControls);
    }
    
    // Initialize image upload
    const imgElem = document.getElementById('uploaded-image');
    const imgPlaceholder = document.getElementById('image-placeholder');
    if (imgElem && imgPlaceholder) {
        initImageUpload(imgElem, imgPlaceholder);
    }
    
    // Initialize export
    if (videoElem) {
        initExport(videoElem);
    }
    
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

    // Update Mode Buttons
    const modeMap = { 'whiteboard': 'board', 'screen': 'screen', 'image': 'image' };
    ['board', 'screen', 'image'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
            if (state.mode === (m === 'board' ? 'whiteboard' : m)) {
                btn.className = 'annotate-mode-btn px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors annotate-mode-btn-active';
            } else {
                btn.className = 'annotate-mode-btn px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors';
            }
        }
    });

    // Visibility of Backgrounds
    const bgWhiteboard = document.getElementById('bg-whiteboard');
    const bgScreen = document.getElementById('bg-screen');
    const bgImage = document.getElementById('bg-image');
    if (bgWhiteboard) bgWhiteboard.classList.toggle('hidden', state.mode !== 'whiteboard');
    if (bgScreen) bgScreen.classList.toggle('hidden', state.mode !== 'screen');
    if (bgImage) bgImage.classList.toggle('hidden', state.mode !== 'image');

    // Undo/Redo State
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = state.historyStep < 0;
    if (btnRedo) btnRedo.disabled = state.historyStep >= state.elements.length - 1;
}

function setupEventListeners() {
    // Resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        redrawCanvas();
    });

    if (!canvas) return;

    // Canvas Interaction with selection support
    canvas.addEventListener('mousedown', (e) => {
        if (state.tool === 'select') {
            handleSelectionStart(e);
        } else {
            handleStart(e);
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        if (state.tool === 'select') {
            handleSelectionMove(e);
        } else {
            handleMove(e);
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        if (state.tool === 'select') {
            handleSelectionEnd(e);
        } else {
            handleEnd(e);
        }
    });
    canvas.addEventListener('mouseleave', (e) => {
        if (state.tool === 'select') {
            handleSelectionEnd(e);
        } else {
            handleEnd(e);
        }
    });
    
    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleStart(mouseEvent);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        handleMove(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        const mouseEvent = new MouseEvent('mouseup', {});
        handleEnd(mouseEvent);
    });

    // Tools
    if (toolContainer) {
        toolContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (btn) {
                setTool(btn.dataset.tool);
                updateUI();
            }
        });
    }

    // Colors
    if (colorContainer) {
        colorContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.color-btn');
            if (btn) {
                setColor(btn.dataset.color);
                updateUI();
            }
        });
    }

    const customColorPicker = document.getElementById('custom-color-picker');
    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            setColor(e.target.value);
            updateUI();
        });
    }

    // Stroke Slider
    if (strokeSlider && strokeIndicator) {
        strokeSlider.addEventListener('input', (e) => {
            state.strokeWidth = parseInt(e.target.value);
            strokeIndicator.style.height = `${state.strokeWidth}px`;
            if(state.tool === 'text') updateTextInputStyle();
        });
    }

    // Actions
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnClear = document.getElementById('btn-clear');
    const btnSnapshot = document.getElementById('btn-snapshot');
    
    if (btnUndo) btnUndo.addEventListener('click', () => { undo(); updateUI(); });
    if (btnRedo) btnRedo.addEventListener('click', () => { redo(); updateUI(); });
    if (btnClear) btnClear.addEventListener('click', () => { clearCanvas(); updateUI(); });
    if (btnSnapshot) btnSnapshot.addEventListener('click', downloadSnapshot);

    // Modes
    const btnModeBoard = document.getElementById('btn-mode-board');
    const btnModeScreen = document.getElementById('btn-mode-screen');
    const btnModeImage = document.getElementById('btn-mode-image');
    const fileInput = document.getElementById('file-input');
    
    if (btnModeBoard) btnModeBoard.addEventListener('click', () => { setMode('whiteboard'); updateUI(); });
    if (btnModeScreen) btnModeScreen.addEventListener('click', async () => { 
        try {
            await startScreenShare(); 
        } catch (err) {
            console.error('Error in startScreenShare:', err);
        } finally {
            updateUI(); 
        }
    });
    if (btnModeImage && fileInput) btnModeImage.addEventListener('click', () => fileInput.click());

    // Video Controls
    const btnPauseVideo = document.getElementById('btn-pause-video');
    const btnStopShare = document.getElementById('btn-stop-share');
    
    if (btnPauseVideo) btnPauseVideo.addEventListener('click', toggleVideoPause);
    if (btnStopShare) btnStopShare.addEventListener('click', stopScreenShare);

    // File Input
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    }

    // Text Input logic
    if (textInputElem) {
        textInputElem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
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
                updateUI();
            }
        });
        textInputElem.addEventListener('blur', () => {
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
                sendToPeer({
                    type: 'ANNOTATION_ELEMENT',
                    element: normalizedElement
                });
            }
            redrawCanvas();
            updateUI();
        });
    }

    // Collaboration button
    const btnCollaborate = document.getElementById('btn-collaborate');
    if (btnCollaborate) {
        btnCollaborate.addEventListener('click', () => {
            if (state.isCollaborating) {
                stopCollaboration();
                updateUI();
            } else {
                showCollaborationModal();
            }
        });
    }
    
    // Fill color picker
    const fillColorPicker = document.getElementById('fill-color-picker');
    if (fillColorPicker) {
        fillColorPicker.addEventListener('input', (e) => {
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
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Selection handlers
function handleSelectionStart(e) {
    const { x, y } = getMousePos(e);
    const point = { x, y };
    
    // Check for Ctrl/Cmd key for multi-selection
    const isMultiSelect = e.ctrlKey || e.metaKey;
    
    // Check if clicking on a handle
    if (state.selectedElementId) {
        const selectedElement = state.elements[state.selectedElementIndex];
        if (selectedElement) {
            const handle = getHandleAtPoint(point, selectedElement);
            if (handle) {
                if (handle.position === 'rotate') {
                    startRotate(point);
                } else {
                    startResize(point, handle);
                }
                return;
            }
        }
    }
    
    // Try to select element at point first
    const elementFound = selectElementAtPoint(point, isMultiSelect);
    
    if (elementFound) {
        // Element was clicked
        const selectedElement = state.elements[state.selectedElementIndex];
        if (selectedElement) {
            // Only start move if not multi-selecting (Ctrl+Click just adds to selection)
            if (!isMultiSelect) {
                startMove(point);
            }
        }
        redrawCanvas();
    } else {
        // No element clicked - start drag selection box
        if (!isMultiSelect) {
            state.isMultiSelecting = true;
            state.selectionBoxStart = point;
            state.selectionBoxEnd = point;
            clearSelection();
            redrawCanvas();
        } else {
            // Ctrl+Click on empty space - just clear if not adding to selection
            clearSelection();
            redrawCanvas();
        }
    }
}

function handleSelectionMove(e) {
    const { x, y } = getMousePos(e);
    const point = { x, y };
    
    // Handle drag selection box (must check this first)
    if (state.isMultiSelecting && state.selectionBoxStart) {
        state.selectionBoxEnd = point;
        redrawCanvas();
        return;
    }
    
    // Handle element manipulation
    // Check for resize/rotate first (they don't require isDrawing flag)
    if (state.selectedElementId) {
        if (state.isResizing) {
            resizeElement(point, e);
            return;
        } else if (state.isRotating) {
            rotateElement(point);
            return;
        } else if (state.isDrawing) {
            moveElement(point);
            return;
        }
    }
}

function handleSelectionEnd(e) {
    // Handle drag selection box end
    if (state.isMultiSelecting && state.selectionBoxStart && state.selectionBoxEnd) {
        const selected = getElementsInBox(state.selectionBoxStart, state.selectionBoxEnd);
        if (selected.length > 0) {
            // Ensure selectedElementIds is initialized
            if (!state.selectedElementIds) {
                state.selectedElementIds = [];
            }
            
            state.selectedElementIds = selected.map(s => s.element.id);
            if (selected.length === 1) {
                state.selectedElementId = selected[0].element.id;
                state.selectedElementIndex = selected[0].index;
                state.selectedElementIds = [selected[0].element.id];
            } else {
                // Multiple elements selected
                state.selectedElementId = selected[0].element.id;
                state.selectedElementIndex = selected[0].index;
                console.log('Multi-selection: Selected', selected.length, 'elements:', state.selectedElementIds);
            }
        } else {
            // No elements in selection box
            clearSelection();
        }
        state.isMultiSelecting = false;
        state.selectionBoxStart = null;
        state.selectionBoxEnd = null;
        redrawCanvas();
        return;
    }
    
    // Handle element manipulation end
    if (state.isResizing) {
        endResize();
    } else if (state.isRotating) {
        endRotate();
    } else if (state.selectedElementId && state.isDrawing) {
        endMove();
    }
    
    state.isDrawing = false;
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Delete key
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedElementId && state.tool === 'select') {
            e.preventDefault();
            deleteElement();
            updateUI();
        }
    }
    
    // Group (Ctrl+G / Cmd+G)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G') && !e.shiftKey) {
        if (state.tool === 'select') {
            e.preventDefault();
            // Ensure selectedElementIds is initialized
            if (!state.selectedElementIds) {
                state.selectedElementIds = [];
            }
            
            // Use selectedElementIds if we have multiple, otherwise check current selection
            let idsToGroup = [];
            
            if (state.selectedElementIds && state.selectedElementIds.length >= 2) {
                idsToGroup = [...state.selectedElementIds];
            } else if (state.selectedElementId) {
                // Only one element selected - can't group
                console.log('Grouping: Need at least 2 elements selected. Currently have 1.');
                return;
            }
            
            if (idsToGroup.length >= 2) {
                console.log('Grouping: Attempting to group', idsToGroup.length, 'elements');
                const group = createGroup(idsToGroup);
                if (group) {
                    console.log('Grouping: Successfully created group');
                }
                updateUI();
            } else {
                console.log('Grouping: Not enough elements selected. Have:', idsToGroup.length);
            }
        }
    }
    
    // Ungroup (Ctrl+Shift+G / Cmd+Shift+G)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        if (state.tool === 'select' && state.selectedElementId) {
            const element = state.elements[state.selectedElementIndex];
            if (isGroup(element)) {
                e.preventDefault();
                ungroupElement(element);
                updateUI();
            }
        }
    }
    
    // Arrow keys for nudging (only when select tool is active and element is selected)
    if (state.tool === 'select' && state.selectedElementId && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                nudgeElement('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                nudgeElement('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                nudgeElement('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                nudgeElement('right');
                break;
        }
    }
}

