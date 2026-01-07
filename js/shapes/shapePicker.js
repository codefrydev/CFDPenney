// Shape Picker UI Component
// Provides categorized UI for selecting shapes (similar to Microsoft Whiteboard)
import { state } from '../state.js';
import { TOOLS } from '../config.js';
import { updateUI } from '../ui.js';

let shapeModal = null;
let currentCategory = 'basic'; // 'basic', 'lines', 'polygons', 'special'

// Shape categories
const SHAPE_CATEGORIES = {
    basic: {
        name: 'Basic',
        icon: 'square',
        shapes: ['rect', 'circle', 'triangle', 'diamond']
    },
    lines: {
        name: 'Lines & Arrows',
        icon: 'minus',
        shapes: ['line', 'arrow']
    },
    polygons: {
        name: 'Polygons',
        icon: 'hexagon',
        shapes: ['pentagon', 'hexagon', 'octagon']
    },
    special: {
        name: 'Stars & Special',
        icon: 'star',
        shapes: ['star', 'ellipse']
    }
};

/**
 * Initialize shape picker
 */
export function initShapePicker() {
    createShapeModal();
}

/**
 * Create shape picker modal
 */
function createShapeModal() {
    // Check if modal already exists
    shapeModal = document.getElementById('shape-picker-modal');
    if (shapeModal) return;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'shape-picker-modal';
    overlay.className = 'hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeShapePicker();
        }
    };
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'relative bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-700 modal-bg';
    modalContent.onclick = (e) => e.stopPropagation();
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-6 border-b modal-header-border';
    header.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center modal-icon-container">
                <i data-lucide="shapes" class="w-6 h-6 text-white"></i>
            </div>
            <h2 class="text-2xl font-bold modal-title">Select Shape</h2>
        </div>
        <button id="close-shape-picker" class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors modal-close-btn">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    `;
    
    // Category Tabs
    const tabs = document.createElement('div');
    tabs.className = 'flex border-b modal-header-border overflow-x-auto';
    tabs.innerHTML = Object.entries(SHAPE_CATEGORIES).map(([key, category]) => `
        <button class="shape-tab px-4 py-3 font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${key === currentCategory ? 'shape-tab-active' : ''}" 
                data-category="${key}">
            <i data-lucide="${category.icon}" class="w-4 h-4"></i>
            <span>${category.name}</span>
        </button>
    `).join('');
    
    // Content area
    const content = document.createElement('div');
    content.id = 'shape-picker-content';
    content.className = 'p-6';
    
    modalContent.appendChild(header);
    modalContent.appendChild(tabs);
    modalContent.appendChild(content);
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    
    // Event listeners
    header.querySelector('#close-shape-picker').addEventListener('click', closeShapePicker);
    
    tabs.querySelectorAll('.shape-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.shape-tab').forEach(t => t.classList.remove('shape-tab-active'));
            tab.classList.add('shape-tab-active');
            currentCategory = tab.dataset.category;
            renderShapeContent(currentCategory);
        });
    });
    
    // Initial render
    renderShapeContent(currentCategory);
    
    // Update Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Render shape content based on category
 */
function renderShapeContent(category) {
    const content = document.getElementById('shape-picker-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    const categoryData = SHAPE_CATEGORIES[category];
    if (!categoryData) return;
    
    // Create grid
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 gap-4';
    
    categoryData.shapes.forEach(shapeId => {
        const tool = TOOLS.find(t => t.id === shapeId);
        if (!tool) return;
        
        const button = document.createElement('button');
        const isActive = state.tool === shapeId;
        button.className = `shape-option p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
            isActive ? 'shape-option-active' : ''
        }`;
        button.style.borderColor = isActive ? 'var(--accent-primary)' : 'var(--border-primary)';
        button.style.backgroundColor = isActive ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)';
        button.innerHTML = `
            <i data-lucide="${tool.icon}" class="w-8 h-8" style="color: ${isActive ? 'var(--accent-primary)' : 'var(--text-primary)'}"></i>
            <span class="text-xs font-medium" style="color: ${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}">${tool.label}</span>
        `;
        button.onclick = () => selectShape(shapeId);
        grid.appendChild(button);
    });
    
    content.appendChild(grid);
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Select a shape and set it as the active tool
 */
function selectShape(shapeId) {
    // Close picker first
    closeShapePicker();
    
    // Set the tool directly (bypass setTool to avoid opening picker again)
    state.tool = shapeId;
    
    // If we're in penney mode, sync the tool to penneyState
    // Check if penneyMain sync function exists (we're in penney mode)
    if (window.syncRegularStateToPenney) {
        window.syncRegularStateToPenney();
    }
    
    // Update UI to reflect the change
    updateUI();
}

/**
 * Open shape picker
 */
export function openShapePicker() {
    if (!shapeModal) {
        createShapeModal();
    }
    
    // Update active state in content
    renderShapeContent(currentCategory);
    
    shapeModal.classList.remove('hidden');
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Refresh shape picker to show current active shape
 */
export function refreshShapePicker() {
    if (shapeModal && !shapeModal.classList.contains('hidden')) {
        renderShapeContent(currentCategory);
        if (window.lucide) {
            setTimeout(() => lucide.createIcons(), 10);
        }
    }
}

/**
 * Close shape picker
 */
export function closeShapePicker() {
    if (shapeModal) {
        shapeModal.classList.add('hidden');
    }
}

