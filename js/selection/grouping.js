// Grouping System
// Provides functionality to group and ungroup multiple elements
import { state } from '../state.js';
import { getBoundingBox } from '../shapes/shapeUtils.js';
import { redrawCanvas, normalizeCoordinates } from '../canvas.js';
import { sendToAllPeers } from '../collaboration.js';
import { clearSelection } from './selectionCore.js';

/**
 * Create a group from selected elements
 */
export function createGroup(elementIds) {
    if (!elementIds || elementIds.length < 2) {
        return null;
    }
    
    // Find all elements by their IDs (check current visible elements)
    const elementsToGroup = [];
    const indicesToRemove = [];
    const visibleElements = state.elements.slice(0, state.historyStep + 1);
    
    visibleElements.forEach((el, index) => {
        if (elementIds.includes(el.id)) {
            elementsToGroup.push(el);
            indicesToRemove.push(index);
        }
    });
    
    if (elementsToGroup.length < 2) {
        return null;
    }
    
    
    // Calculate group bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    elementsToGroup.forEach(el => {
        const bbox = getBoundingBox(el.start, el.end);
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
    });
    
    // Calculate relative positions for grouped elements
    const groupStart = { x: minX, y: minY };
    const groupEnd = { x: maxX, y: maxY };
    
    // Create group element
    const groupId = `group-${Date.now()}-${Math.random()}`;
    const groupElement = {
        id: groupId,
        type: 'group',
        start: groupStart,
        end: groupEnd,
        children: elementsToGroup.map(el => ({
            id: el.id,
            type: el.type,
            // Store relative position to group origin
            relativeStart: { x: el.start.x - minX, y: el.start.y - minY },
            relativeEnd: { x: el.end.x - minX, y: el.end.y - minY },
            // Store all element properties
            element: { ...el }
        })),
        isActive: false
    };
    
    // Remove grouped elements (in reverse order to maintain indices)
    // We need to work with the full elements array but only remove from visible range
    indicesToRemove.sort((a, b) => b - a).forEach(index => {
        state.elements.splice(index, 1);
    });
    
    // Update history step after removals
    state.historyStep = state.historyStep - indicesToRemove.length;
    
    // Add group element
    state.elements.push(groupElement);
    state.historyStep = state.elements.length - 1;
    
    // Update selection to the new group
    state.selectedElementId = groupId;
    state.selectedElementIndex = state.elements.length - 1;
    
    // Send to peers
    if (state.isCollaborating) {
        sendToAllPeers({
            type: 'GROUP_CREATE',
            groupId: groupId,
            elementIds: elementIds,
            groupStart: normalizeCoordinates(groupStart.x, groupStart.y),
            groupEnd: normalizeCoordinates(groupEnd.x, groupEnd.y),
            children: groupElement.children.map(child => ({
                ...child,
                relativeStart: normalizeCoordinates(child.relativeStart.x, child.relativeStart.y),
                relativeEnd: normalizeCoordinates(child.relativeEnd.x, child.relativeEnd.y)
            }))
        });
    }
    
    redrawCanvas();
    return groupElement;
}

/**
 * Ungroup a group element
 */
export function ungroupElement(groupElement) {
    if (!groupElement || groupElement.type !== 'group' || !groupElement.children) {
        return false;
    }
    
    const groupIndex = state.elements.findIndex(el => el.id === groupElement.id);
    if (groupIndex === -1) return false;
    
    // Restore children elements with absolute positions
    const restoredElements = groupElement.children.map(child => {
        const element = { ...child.element };
        // Restore absolute positions
        element.start = {
            x: groupElement.start.x + child.relativeStart.x,
            y: groupElement.start.y + child.relativeStart.y
        };
        element.end = {
            x: groupElement.start.x + child.relativeEnd.x,
            y: groupElement.start.y + child.relativeEnd.y
        };
        return element;
    });
    
    // Remove group element
    state.elements.splice(groupIndex, 1);
    
    // Add restored elements
    state.elements.push(...restoredElements);
    state.historyStep = state.elements.length - 1;
    
    clearSelection();
    
    // Send to peers
    if (state.isCollaborating) {
        sendToAllPeers({
            type: 'GROUP_UNGROUP',
            groupId: groupElement.id,
            elementIds: restoredElements.map(el => el.id)
        });
    }
    
    redrawCanvas();
    return true;
}

/**
 * Get all elements in a group
 */
export function getGroupChildren(groupElement) {
    if (!groupElement || groupElement.type !== 'group' || !groupElement.children) {
        return [];
    }
    
    // Return children with absolute positions
    return groupElement.children.map(child => {
        const element = { ...child.element };
        element.start = {
            x: groupElement.start.x + child.relativeStart.x,
            y: groupElement.start.y + child.relativeStart.y
        };
        element.end = {
            x: groupElement.start.x + child.relativeEnd.x,
            y: groupElement.start.y + child.relativeEnd.y
        };
        return element;
    });
}

/**
 * Update group bounding box after children are moved/resized
 */
export function updateGroupBounds(groupElement) {
    if (!groupElement || groupElement.type !== 'group' || !groupElement.children) {
        return;
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    groupElement.children.forEach(child => {
        const absStart = {
            x: groupElement.start.x + child.relativeStart.x,
            y: groupElement.start.y + child.relativeStart.y
        };
        const absEnd = {
            x: groupElement.start.x + child.relativeEnd.x,
            y: groupElement.start.y + child.relativeEnd.y
        };
        const bbox = getBoundingBox(absStart, absEnd);
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
    });
    
    groupElement.start = { x: minX, y: minY };
    groupElement.end = { x: maxX, y: maxY };
}

/**
 * Check if element is a group
 */
export function isGroup(element) {
    return element && element.type === 'group';
}

