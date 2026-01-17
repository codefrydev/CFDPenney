// Trail Animation System for Desktop
import { state } from './state.js';

/**
 * Calculate the opacity for a trail stroke based on its age and type
 * @param {Object} stroke - The trail stroke
 * @param {number} pointIndex - Optional: index of specific point (for sequential fade)
 * @param {number} totalPoints - Optional: total number of points (for sequential fade)
 * @returns {number} Opacity value between 0 and 1
 */
export function getTrailOpacity(stroke, pointIndex = null, totalPoints = null) {
    // Non-trail strokes always have full opacity
    if (stroke.tool !== 'trail') {
        return 1.0;
    }
    
    // If no timestamp, treat as permanent (shouldn't happen)
    if (!stroke.timestamp) {
        return 1.0;
    }
    
    const age = Date.now() - stroke.timestamp;
    const progress = age / state.trailFadeDuration;
    
    // Fully faded
    if (progress >= 1) {
        return 0;
    }
    
    const trailType = stroke.trailType || state.trailType || 'fade';
    
    switch (trailType) {
        case 'sequential':
            // Snake trail: beginning disappears first
            if (pointIndex !== null && totalPoints !== null && totalPoints > 1) {
                const pointProgress = pointIndex / (totalPoints - 1);
                const fadeStart = pointProgress * 0.7;
                const adjustedProgress = (progress - fadeStart) / (1 - fadeStart);
                return Math.max(0, Math.min(1, 1 - adjustedProgress));
            }
            return 1 - progress;
            
        case 'laser':
            // Laser effect: stays bright then fades quickly
            if (progress < 0.7) {
                return 1.0;
            } else {
                const endProgress = (progress - 0.7) / 0.3;
                return 1 - (endProgress * endProgress);
            }
            
        case 'fade':
        default:
            return 1 - progress;
    }
}

/**
 * Check if a trail stroke has fully expired
 * @param {Object} stroke - The trail stroke
 * @returns {boolean} True if stroke should be removed
 */
export function isTrailExpired(stroke) {
    if (stroke.tool !== 'trail' || !stroke.timestamp) {
        return false;
    }
    
    const age = Date.now() - stroke.timestamp;
    return age >= state.trailFadeDuration;
}

/**
 * Remove expired trail strokes from the state
 * Removes from remoteStrokes Map
 * @param {Map} remoteStrokes - The Map of remote strokes
 * @returns {number} Number of strokes removed
 */
export function cleanupExpiredTrails(remoteStrokes) {
    let removedCount = 0;
    
    // Iterate through strokes and remove expired ones
    for (const [strokeId, stroke] of remoteStrokes.entries()) {
        if (isTrailExpired(stroke)) {
            remoteStrokes.delete(strokeId);
            removedCount++;
        }
    }
    
    return removedCount;
}

/**
 * Check if there are any active trail strokes
 * @param {Map} remoteStrokes - The Map of remote strokes
 * @returns {boolean} True if trails exist
 */
export function hasActiveTrails(remoteStrokes) {
    for (const stroke of remoteStrokes.values()) {
        if (stroke.tool === 'trail') {
            return true;
        }
    }
    return false;
}

/**
 * Initialize trail system
 * Should be called when the overlay starts
 */
export function initTrails() {
    // Ensure animation is stopped on initialization
    if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
    state.trailsActive = false;
}
