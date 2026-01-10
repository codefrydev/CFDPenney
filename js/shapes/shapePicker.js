// Shape Picker UI Component
// Provides categorized UI for selecting shapes (similar to Microsoft Whiteboard)
import { state } from '../state.js';
import { TOOLS } from '../config.js';
import { updateUI } from '../ui.js';

let shapePanel = null;
let currentCategory = 'basic'; // 'basic', 'lines', 'polygons', 'special'
let expandedCategories = { basic: true }; // Track which categories are expanded
let searchQuery = '';
let isResizing = false;
let startX = 0;
let startWidth = 0;
const MIN_WIDTH = 240;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 320;

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
    createShapePanel();
}

/**
 * Create shape picker as a draggable sidebar panel
 */
function createShapePanel() {
    // Check if panel already exists
    shapePanel = document.getElementById('shape-picker-panel');
    if (shapePanel) return;
    
    // Get workspace container to append panel
    const workspace = document.getElementById('workspace-container');
    if (!workspace) {
        // Retry if workspace isn't ready
        setTimeout(createShapePanel, 100);
        return;
    }
    
    // Create panel container
    const panelContainer = document.createElement('div');
    panelContainer.id = 'shape-picker-panel';
    panelContainer.className = 'shape-picker-panel hidden';
    panelContainer.style.width = `${DEFAULT_WIDTH}px`;
    
    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'shape-picker-resize-handle';
    resizeHandle.className = 'shape-picker-resize-handle';
    
    // Panel content
    const panelContent = document.createElement('div');
    panelContent.className = 'shape-picker-panel-content';
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between p-4 border-b modal-header-border shape-picker-header';
    header.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center modal-icon-container">
                <i data-lucide="shapes" class="w-5 h-5 text-white"></i>
            </div>
            <h2 class="text-lg font-bold modal-title">Shapes</h2>
        </div>
        <button id="toggle-shape-picker" class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors modal-close-btn" title="Toggle Shapes Panel">
            <i data-lucide="chevron-left" class="w-5 h-5" id="shape-picker-toggle-icon"></i>
        </button>
    `;
    
    // Search bar (draw.io style)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'p-3 border-b modal-header-border';
    searchContainer.innerHTML = `
        <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
            <input 
                type="text" 
                id="shape-search-input" 
                placeholder="Search shapes..." 
                class="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
        </div>
    `;
    
    // Content area with scrollable categories
    const content = document.createElement('div');
    content.id = 'shape-picker-content';
    content.className = 'shape-picker-content overflow-y-auto flex-1';
    
    panelContent.appendChild(header);
    panelContent.appendChild(searchContainer);
    panelContent.appendChild(content);
    panelContainer.appendChild(resizeHandle);
    panelContainer.appendChild(panelContent);
    
    // Insert panel before canvas wrapper (after toolbar)
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper && canvasWrapper.parentNode) {
        canvasWrapper.parentNode.insertBefore(panelContainer, canvasWrapper);
    } else {
        workspace.appendChild(panelContainer);
    }
    
    // Event listeners
    const toggleBtn = header.querySelector('#toggle-shape-picker');
    toggleBtn.addEventListener('click', toggleShapePicker);
    
    // Search functionality
    const searchInput = searchContainer.querySelector('#shape-search-input');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAllCategories();
    });
    
    // Keyboard shortcut for search (like draw.io)
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchQuery = '';
            renderAllCategories();
            searchInput.blur();
        }
    });
    
    // Setup resize functionality
    setupPanelResize(resizeHandle, panelContainer);
    
    // Initial render - show all categories
    renderAllCategories();
    
    // Update Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Setup panel resize functionality
 */
function setupPanelResize(resizeHandle, panel) {
    const handleMouseDown = (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        resizeHandle.classList.add('resizing');
        document.body.classList.add('resizing-shape-panel');
        
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startX; // Normal direction for left panel
        let newWidth = startWidth + diff;
        
        // Constrain width
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        
        // Update panel width
        panel.style.width = `${newWidth}px`;
    };
    
    const handleMouseUp = () => {
        if (!isResizing) return;
        
        isResizing = false;
        resizeHandle.classList.remove('resizing');
        document.body.classList.remove('resizing-shape-panel');
    };
    
    // Add event listeners
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

/**
 * Render all categories in collapsible sections (draw.io style)
 */
function renderAllCategories() {
    const content = document.getElementById('shape-picker-content');
    if (!content) return;
    
    content.innerHTML = '';
    
    Object.entries(SHAPE_CATEGORIES).forEach(([key, categoryData]) => {
        // Filter shapes by search query
        const filteredShapes = categoryData.shapes.filter(shapeId => {
            if (!searchQuery) return true;
            const tool = TOOLS.find(t => t.id === shapeId);
            if (!tool) return false;
            return tool.label.toLowerCase().includes(searchQuery) || 
                   tool.id.toLowerCase().includes(searchQuery);
        });
        
        // Skip category if no shapes match search
        if (filteredShapes.length === 0 && searchQuery) return;
        
        const isExpanded = expandedCategories[key] || false;
        
        // Category header (collapsible)
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'shape-category-header flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/50 transition-colors border-b border-gray-700/50';
        categoryHeader.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-gray-400 category-chevron"></i>
                <i data-lucide="${categoryData.icon}" class="w-4 h-4 text-gray-300"></i>
                <span class="font-medium text-sm text-gray-200">${categoryData.name}</span>
                <span class="text-xs text-gray-500 ml-1">(${filteredShapes.length})</span>
            </div>
        `;
        
        // Category content (collapsible)
        const categoryContent = document.createElement('div');
        categoryContent.className = `shape-category-content ${isExpanded ? '' : 'hidden'}`;
        categoryContent.style.transition = 'all 0.2s ease';
        
        // Grid for shapes
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-4 gap-2 p-3 shape-picker-grid';
        
        filteredShapes.forEach((shapeId, index) => {
            const tool = TOOLS.find(t => t.id === shapeId);
            if (!tool) return;
            
            const button = document.createElement('button');
            const isActive = state.tool === shapeId;
            button.className = `shape-option p-3 rounded-lg border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 ${
                isActive ? 'shape-option-active' : ''
            }`;
            button.style.borderColor = isActive ? 'var(--accent-primary)' : 'var(--border-primary)';
            button.style.backgroundColor = isActive ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)';
            button.title = tool.label;
            button.innerHTML = `
                <i data-lucide="${tool.icon}" class="w-6 h-6 shape-option-icon" style="color: ${isActive ? 'var(--accent-primary)' : 'var(--text-primary)'}"></i>
                <span class="text-xs font-medium shape-option-label truncate w-full text-center" style="color: ${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}">${tool.label}</span>
            `;
            button.onclick = () => selectShape(shapeId);
            grid.appendChild(button);
        });
        
        categoryContent.appendChild(grid);
        
        // Toggle expand/collapse
        categoryHeader.addEventListener('click', () => {
            expandedCategories[key] = !expandedCategories[key];
            categoryContent.classList.toggle('hidden');
            const chevron = categoryHeader.querySelector('.category-chevron');
            chevron.setAttribute('data-lucide', expandedCategories[key] ? 'chevron-down' : 'chevron-right');
            if (window.lucide) {
                lucide.createIcons();
            }
        });
        
        // Category container
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'shape-category';
        categoryContainer.appendChild(categoryHeader);
        categoryContainer.appendChild(categoryContent);
        
        content.appendChild(categoryContainer);
    });
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Select a shape and set it as the active tool
 */
function selectShape(shapeId) {
    // Don't close panel - keep it open for better UX
    // Set the tool directly (bypass setTool to avoid opening picker again)
    state.tool = shapeId;
    
    // If we're in penney mode, sync the tool to penneyState
    // Check if penneyMain sync function exists (we're in penney mode)
    if (window.syncRegularStateToPenney) {
        window.syncRegularStateToPenney();
    }
    
    // Update UI to reflect the change
    updateUI();
    
    // Refresh picker to show active state
    refreshShapePicker();
}

/**
 * Open shape picker
 */
export function openShapePicker() {
    if (!shapePanel) {
        createShapePanel();
    }
    
    if (!shapePanel) return;
    
    // Reset search
    const searchInput = document.getElementById('shape-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchQuery = '';
    }
    
    // Update active state in content
    renderAllCategories();
    
    // Show panel
    shapePanel.classList.remove('hidden');
    
    // Update toggle icon
    const toggleIcon = document.getElementById('shape-picker-toggle-icon');
    if (toggleIcon) {
        toggleIcon.setAttribute('data-lucide', 'chevron-left');
    }
    
    // Focus search input (like draw.io)
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
    
    // Update Lucide icons
    if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 10);
    }
}

/**
 * Toggle shape picker panel
 */
function toggleShapePicker() {
    if (!shapePanel) {
        openShapePicker();
        return;
    }
    
    const isHidden = shapePanel.classList.contains('hidden');
    const toggleIcon = document.getElementById('shape-picker-toggle-icon');
    
    if (isHidden) {
        shapePanel.classList.remove('hidden');
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', 'chevron-left');
        }
        renderAllCategories();
    } else {
        shapePanel.classList.add('hidden');
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', 'chevron-right');
        }
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Refresh shape picker to show current active shape
 */
export function refreshShapePicker() {
    if (shapePanel && !shapePanel.classList.contains('hidden')) {
        renderAllCategories();
        if (window.lucide) {
            setTimeout(() => lucide.createIcons(), 10);
        }
    }
}

/**
 * Close shape picker (alias for toggle - hides panel)
 */
export function closeShapePicker() {
    if (shapePanel) {
        shapePanel.classList.add('hidden');
        const toggleIcon = document.getElementById('shape-picker-toggle-icon');
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', 'chevron-right');
        }
        if (window.lucide) {
            lucide.createIcons();
        }
    }
}

