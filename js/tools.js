// Tool Management
import { state } from './state.js';
import { TOOLS, COLORS } from './config.js';
import { openStickerPicker } from './stickers/stickerPicker.js';
import { openShapePicker } from './shapes/shapePicker.js';

let toolContainer = null;
let colorContainer = null;
let fillColorContainer = null;
let textInputElem = null;

export function initTools(toolContainerEl, colorContainerEl, textInputEl, fillColorContainerEl = null) {
    toolContainer = toolContainerEl;
    colorContainer = colorContainerEl;
    fillColorContainer = fillColorContainerEl;
    textInputElem = textInputEl;
}

export function renderTools() {
    if (!toolContainer) return;
    
    // Separate tools into categories
    const drawingTools = TOOLS.filter(t => t.category === 'drawing');
    const shapeTools = TOOLS.filter(t => t.category === 'shapes');
    const stickerTool = TOOLS.find(t => t.id === 'sticker');
    const utilityTools = TOOLS.filter(t => t.category === 'utilities');
    
    let html = '';
    
    // Render drawing tools
    drawingTools.forEach(t => {
        html += `
            <button data-tool="${t.id}" title="${t.label}" 
                class="annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200 ${state.tool === t.id ? 'annotate-tool-btn-active shadow-lg scale-105' : ''}">
                <i data-lucide="${t.icon}" class="w-5 h-5 pointer-events-none"></i>
            </button>
        `;
    });
    
    // Render Shapes button (opens picker)
    const isShapeActive = shapeTools.some(t => state.tool === t.id);
    html += `
        <button data-tool="shapes" title="Shapes" 
            class="annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200 ${isShapeActive ? 'annotate-tool-btn-active shadow-lg scale-105' : ''}">
            <i data-lucide="shapes" class="w-5 h-5 pointer-events-none"></i>
        </button>
    `;
    
    // Render sticker tool
    if (stickerTool) {
        html += `
            <button data-tool="${stickerTool.id}" title="${stickerTool.label}" 
                class="annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200 ${state.tool === stickerTool.id ? 'annotate-tool-btn-active shadow-lg scale-105' : ''}">
                <i data-lucide="${stickerTool.icon}" class="w-5 h-5 pointer-events-none"></i>
            </button>
        `;
    }
    
    // Render utility tools
    utilityTools.forEach(t => {
        html += `
            <button data-tool="${t.id}" title="${t.label}" 
                class="annotate-tool-btn tool-btn p-3 rounded-xl flex justify-center transition-all duration-200 ${state.tool === t.id ? 'annotate-tool-btn-active shadow-lg scale-105' : ''}">
                <i data-lucide="${t.icon}" class="w-5 h-5 pointer-events-none"></i>
            </button>
        `;
    });
    
    toolContainer.innerHTML = html;
}

export function renderColors() {
    if (!colorContainer) return;
    // Clear existing colors (except custom picker)
    const existingColors = colorContainer.querySelectorAll('.color-btn');
    existingColors.forEach(btn => btn.remove());
    
    // Render first 5 predefined colors
    const predefined = COLORS.slice(0, 5).map(c => `
        <button data-color="${c}" 
            class="color-btn w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${state.color === c ? 'border-white scale-110' : 'border-transparent'}"
            style="background-color: ${c};">
        </button>
    `).join('');
    
    // Insert before the custom picker
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = predefined;
    const customPicker = colorContainer.querySelector('#custom-color-picker').parentElement;
    while (tempDiv.firstChild) {
        colorContainer.insertBefore(tempDiv.firstChild, customPicker);
    }
}

export function setTool(toolId) {
    console.log('[tools] setTool - setting tool to:', toolId, 'current tool:', state.tool);
    confirmText(); // Finish any active text
    
    // Handle sticker tool - open picker
    if (toolId === 'sticker') {
        openStickerPicker();
        return; // Don't change tool, keep previous tool
    }
    
    // Handle shapes button - open shape picker
    if (toolId === 'shapes') {
        openShapePicker();
        return; // Don't change tool, keep previous tool
    }
    
    state.tool = toolId;
    console.log('[tools] setTool - tool set to:', state.tool);
}

export function setColor(colorHex) {
    state.color = colorHex;
    if(state.textInput) {
        updateTextInputStyle();
    }
}

export function setFillColor(colorHex) {
    state.fillColor = colorHex;
}

export function toggleFill() {
    state.filled = !state.filled;
}

// Text Tool Logic
export function startText(x, y) {
    if (!textInputElem) return;
    state.textInput = { x, y, text: '' };
    
    textInputElem.value = '';
    textInputElem.style.left = `${x}px`;
    textInputElem.style.top = `${y}px`;
    textInputElem.classList.remove('hidden');
    updateTextInputStyle();
    
    // Wait a tick for visibility then focus
    setTimeout(() => textInputElem.focus(), 10);
}

export function updateTextInputStyle() {
    if (!textInputElem) return;
    textInputElem.style.fontSize = `${state.strokeWidth * 6}px`;
    textInputElem.style.color = state.color;
    textInputElem.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
}

export function confirmText() {
    if (!state.textInput || !textInputElem) return;
    
    const text = textInputElem.value.trim();
    if (text) {
        const newElement = {
            type: 'text_rendered',
            color: state.color,
            width: state.strokeWidth,
            text: text,
            start: { x: state.textInput.x, y: state.textInput.y }
        };
        
        state.elements = state.elements.slice(0, state.historyStep + 1);
        state.elements.push(newElement);
        state.historyStep++;
        
        // Send to peer will be handled by drawing module
        // Return the element for collaboration
        return newElement;
    }

    // Reset
    state.textInput = null;
    textInputElem.classList.add('hidden');
    textInputElem.value = '';
    return null;
}

