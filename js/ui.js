// UI Management
import { state } from './state.js';
import { resizeCanvas, redrawCanvas, initCanvas } from './canvas.js';
import { renderTools, renderColors, setTool, setColor, confirmText, initTools, updateTextInputStyle } from './tools.js';
import { handleStart, handleMove, handleEnd, initDrawing } from './drawing.js';
import { undo, redo, clearCanvas } from './history.js';
import { startScreenShare, stopScreenShare, toggleVideoPause, setMode, initScreenShare } from './screenShare.js';
import { handleImageUpload, initImageUpload } from './imageUpload.js';
import { downloadSnapshot, initExport } from './export.js';
import { stopCollaboration, sendToAllPeers } from './collaboration.js';
import { showCollaborationModal } from './modal.js';

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
    
    // Render initial UI
    renderTools();
    renderColors();
    setupEventListeners();
    resizeCanvas();
    updateUI();
}

export function updateUI() {
    // Update Tool Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.dataset.tool === state.tool) {
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

    // Canvas Interaction
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);
    
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
    if (btnModeScreen) btnModeScreen.addEventListener('click', startScreenShare);
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
                    sendToAllPeers({
                        type: 'ANNOTATION_ELEMENT',
                        element: newElement
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
                sendToPeer({
                    type: 'ANNOTATION_ELEMENT',
                    element: newElement
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
}

