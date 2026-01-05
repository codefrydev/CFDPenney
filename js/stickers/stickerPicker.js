// Sticker Picker UI Component
// Provides UI for selecting and placing stickers
import { state } from '../state.js';
import { EMOJI_LIBRARY, ICON_LIBRARY, EMOJI_CATEGORIES, ICON_CATEGORIES } from './stickerLibrary.js';
import { redrawCanvas, normalizeCoordinates } from '../canvas.js';
import { sendToAllPeers } from '../collaboration.js';

let stickerModal = null;
let currentStickerType = 'emoji'; // 'emoji', 'icon', 'image'

/**
 * Initialize sticker picker
 */
export function initStickerPicker() {
    createStickerModal();
}

/**
 * Create sticker picker modal
 */
function createStickerModal() {
    // Check if modal already exists
    stickerModal = document.getElementById('sticker-picker-modal');
    if (stickerModal) return;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'sticker-picker-modal';
    overlay.className = 'hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeStickerPicker();
        }
    };
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-700 modal-bg';
    modalContent.onclick = (e) => e.stopPropagation();
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-6 border-b modal-header-border';
    header.innerHTML = `
        <h2 class="text-2xl font-bold modal-title">Select Sticker</h2>
        <button id="close-sticker-picker" class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors modal-close-btn">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    `;
    
    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'flex border-b modal-header-border';
    tabs.innerHTML = `
        <button class="sticker-tab px-4 py-2 font-medium transition-colors sticker-tab-active" data-type="emoji">
            Emoji
        </button>
        <button class="sticker-tab px-4 py-2 font-medium transition-colors" data-type="icon">
            Icons
        </button>
        <button class="sticker-tab px-4 py-2 font-medium transition-colors" data-type="image">
            Image
        </button>
    `;
    
    // Content area
    const content = document.createElement('div');
    content.id = 'sticker-picker-content';
    content.className = 'p-6 max-h-96 overflow-y-auto';
    
    modalContent.appendChild(header);
    modalContent.appendChild(tabs);
    modalContent.appendChild(content);
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    
    // Event listeners
    header.querySelector('#close-sticker-picker').addEventListener('click', closeStickerPicker);
    
    tabs.querySelectorAll('.sticker-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('sticker-tab-active'));
            tab.classList.add('sticker-tab-active');
            currentStickerType = tab.dataset.type;
            renderStickerContent(currentStickerType);
        });
    });
    
    // Initial render
    renderStickerContent('emoji');
    
    // Update Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Render sticker content based on type
 */
function renderStickerContent(type) {
    const content = document.getElementById('sticker-picker-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    if (type === 'emoji') {
        renderEmojiGrid(content);
    } else if (type === 'icon') {
        renderIconGrid(content);
    } else if (type === 'image') {
        renderImageUpload(content);
    }
}

/**
 * Render emoji grid
 */
function renderEmojiGrid(container) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-8 gap-2';
    
    EMOJI_LIBRARY.forEach(emoji => {
        const button = document.createElement('button');
        button.className = 'p-2 text-2xl hover:bg-gray-700 rounded-lg transition-colors';
        button.textContent = emoji;
        button.onclick = () => selectSticker('emoji', emoji);
        grid.appendChild(button);
    });
    
    container.appendChild(grid);
}

/**
 * Render icon grid
 */
function renderIconGrid(container) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-6 gap-2';
    
    ICON_LIBRARY.forEach(iconName => {
        const button = document.createElement('button');
        button.className = 'p-3 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center';
        button.innerHTML = `<i data-lucide="${iconName}" class="w-6 h-6"></i>`;
        button.onclick = () => selectSticker('icon', iconName);
        grid.appendChild(button);
    });
    
    container.appendChild(grid);
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Render image upload
 */
function renderImageUpload(container) {
    const uploadArea = document.createElement('div');
    uploadArea.className = 'border-2 border-dashed border-gray-600 rounded-lg p-8 text-center';
    uploadArea.innerHTML = `
        <input type="file" id="sticker-image-upload" accept="image/*" class="hidden">
        <label for="sticker-image-upload" class="cursor-pointer">
            <i data-lucide="upload" class="w-12 h-12 mx-auto mb-4 text-gray-400"></i>
            <p class="text-gray-300 mb-2">Click to upload an image</p>
            <p class="text-sm text-gray-500">PNG, JPG, GIF up to 5MB</p>
        </label>
    `;
    
    const fileInput = uploadArea.querySelector('#sticker-image-upload');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                selectSticker('image', event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
    
    container.appendChild(uploadArea);
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Select a sticker and place it on canvas
 */
function selectSticker(type, data) {
    // Close picker
    closeStickerPicker();
    
    // Set tool to sticker temporarily
    const previousTool = state.tool;
    state.tool = 'sticker';
    
    // Create sticker element
    const elementId = `local-${Date.now()}-${Math.random()}`;
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    
    // Use canvas center (internal coordinates)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const newElement = {
        id: elementId,
        type: 'sticker',
        stickerType: type,
        stickerData: data,
        color: state.color,
        width: state.strokeWidth,
        start: { x: centerX, y: centerY },
        end: { x: centerX, y: centerY },
        isActive: false
    };
    
    // Add to elements
    state.elements = state.elements.slice(0, state.historyStep + 1);
    state.elements.push(newElement);
    state.historyStep++;
    
    // Send to peers
    if (state.isCollaborating) {
        const normalized = normalizeCoordinates(centerX, centerY);
        sendToAllPeers({
            type: 'ANNOTATION_ELEMENT',
            element: {
                ...newElement,
                start: normalized
            }
        });
    }
    
    // Restore previous tool
    state.tool = previousTool;
    
    redrawCanvas();
}

/**
 * Open sticker picker
 */
export function openStickerPicker() {
    if (!stickerModal) {
        createStickerModal();
    }
    stickerModal.classList.remove('hidden');
    renderStickerContent(currentStickerType);
}

/**
 * Close sticker picker
 */
export function closeStickerPicker() {
    if (stickerModal) {
        stickerModal.classList.add('hidden');
    }
}

