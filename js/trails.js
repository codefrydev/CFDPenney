// Trail Animation System
import { state } from './state.js';
import { redrawCanvas } from './canvas.js';

/**
 * Calculate the opacity for a trail element based on its age and type
 * @param {Object} element - The trail element
 * @param {number} pointIndex - Optional: index of specific point (for sequential fade)
 * @param {number} totalPoints - Optional: total number of points (for sequential fade)
 * @returns {number} Opacity value between 0 and 1
 */
export function getTrailOpacity(element, pointIndex = null, totalPoints = null) {
    // Non-trail elements always have full opacity
    if (element.type !== 'trail') {
        return 1.0;
    }
    
    // If no timestamp, treat as permanent (shouldn't happen)
    if (!element.timestamp) {
        return 1.0;
    }
    
    const age = Date.now() - element.timestamp;
    const progress = age / state.trailFadeDuration;
    
    // Fully faded
    if (progress >= 1) {
        return 0;
    }
    
    const trailType = element.trailType || state.trailType || 'fade';
    
    switch (trailType) {
        case 'sequential':
            // Snake trail: beginning disappears first
            // Each point fades based on its position in the stroke
            if (pointIndex !== null && totalPoints !== null && totalPoints > 1) {
                const pointProgress = pointIndex / (totalPoints - 1); // 0 to 1
                const fadeStart = pointProgress * 0.7; // Earlier points start fading sooner
                const adjustedProgress = (progress - fadeStart) / (1 - fadeStart);
                return Math.max(0, Math.min(1, 1 - adjustedProgress));
            }
            // Fallback to regular fade if no point info
            return 1 - progress;
            
        case 'laser':
            // Laser effect: stays bright then fades quickly at the end
            // Also has a glow effect (handled in rendering)
            if (progress < 0.7) {
                return 1.0; // Stay at full brightness for 70% of duration
            } else {
                const endProgress = (progress - 0.7) / 0.3; // Last 30%
                return 1 - (endProgress * endProgress); // Quadratic fade for quick drop
            }
            
        case 'fade':
        default:
            // Linear fade from 1 to 0
            return 1 - progress;
    }
}

/**
 * Check if a trail element has fully expired
 * @param {Object} element - The trail element
 * @returns {boolean} True if element should be removed
 */
export function isTrailExpired(element) {
    if (element.type !== 'trail' || !element.timestamp) {
        return false;
    }
    
    const age = Date.now() - element.timestamp;
    return age >= state.trailFadeDuration;
}

/**
 * Remove expired trail elements from the state
 * Removes from both local and peer elements
 */
export function cleanupExpiredTrails() {
    let removedCount = 0;
    
    // Clean up local elements (up to historyStep)
    const validLocalElements = [];
    for (let i = 0; i <= state.historyStep; i++) {
        const element = state.elements[i];
        if (!isTrailExpired(element)) {
            validLocalElements.push(element);
        } else {
            removedCount++;
        }
    }
    
    // Preserve elements after historyStep (for redo functionality)
    const futureElements = state.elements.slice(state.historyStep + 1);
    state.elements = [...validLocalElements, ...futureElements];
    
    // Adjust historyStep if elements were removed
    state.historyStep = validLocalElements.length - 1;
    
    // Clean up peer elements
    const originalPeerCount = state.peerElements.length;
    state.peerElements = state.peerElements.filter(el => !isTrailExpired(el));
    removedCount += originalPeerCount - state.peerElements.length;
    
    return removedCount;
}

/**
 * Check if there are any active trail elements
 * @returns {boolean} True if trails exist on canvas
 */
export function hasActiveTrails() {
    // Check local elements
    for (let i = 0; i <= state.historyStep; i++) {
        if (state.elements[i]?.type === 'trail') {
            return true;
        }
    }
    
    // Check peer elements
    for (const element of state.peerElements) {
        if (element.type === 'trail') {
            return true;
        }
    }
    
    return false;
}

/**
 * Animation loop for trail fading
 * Runs continuously while trails exist
 */
function animationLoop() {
    // Clean up expired trails
    const removed = cleanupExpiredTrails();
    
    // Redraw canvas with updated opacities
    redrawCanvas();
    
    // Check if we should continue the loop
    if (hasActiveTrails()) {
        state.animationFrameId = requestAnimationFrame(animationLoop);
    } else {
        // No more trails, stop the animation
        stopTrailAnimation();
    }
}

/**
 * Start the trail animation loop
 * Safe to call multiple times - won't create duplicate loops
 */
export function startTrailAnimation() {
    // Already running
    if (state.trailsActive && state.animationFrameId !== null) {
        return;
    }
    
    state.trailsActive = true;
    state.animationFrameId = requestAnimationFrame(animationLoop);
}

/**
 * Stop the trail animation loop
 * Cleans up the requestAnimationFrame
 */
export function stopTrailAnimation() {
    if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
    state.trailsActive = false;
}

/**
 * Initialize trail system
 * Should be called when the app starts
 */
export function initTrails() {
    // Ensure animation is stopped on initialization
    stopTrailAnimation();
}
