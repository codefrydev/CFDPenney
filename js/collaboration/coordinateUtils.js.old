// Coordinate Normalization/Denormalization
import { normalizeCoordinates as regularNormalizeCoordinates, denormalizeCoordinates as regularDenormalizeCoordinates } from '../canvas.js';

// Feature detection: Check if penney coordinate functions are available
// This allows us to use penney-specific coordinate functions when on penney page, with fallback to regular functions
// penneyMain.js registers penney functions globally at window.penneyCanvasFunctions for synchronous access

// Helper function to check if we're on penney page
function isPenneyPage() {
    if (typeof window === 'undefined') return false;
    // Check for global marker set by penneyMain.js (most reliable)
    if (window.isPenneyPage) {
        return true;
    }
    // Fallback: Check pathname for penney.html
    if (window.location && window.location.pathname.includes('penney.html')) {
        return true;
    }
    return false;
}

// Helper function to get the appropriate normalizeCoordinates function
function getNormalizeCoordinates() {
    const isPenney = isPenneyPage();
    const hasPenneyFunctions = window.penneyCanvasFunctions && window.penneyCanvasFunctions.normalizeCoordinates;
    
    if (isPenney && hasPenneyFunctions) {
        return window.penneyCanvasFunctions.normalizeCoordinates;
    }
    // Fallback to regular canvas function
    return regularNormalizeCoordinates;
}

// Helper function to get the appropriate denormalizeCoordinates function
function getDenormalizeCoordinates() {
    const isPenney = isPenneyPage();
    const hasPenneyFunctions = window.penneyCanvasFunctions && window.penneyCanvasFunctions.denormalizeCoordinates;
    
    if (isPenney && hasPenneyFunctions) {
        return window.penneyCanvasFunctions.denormalizeCoordinates;
    }
    // Fallback to regular canvas function
    return regularDenormalizeCoordinates;
}

// Helper function to normalize element coordinates for sending
export function normalizeElement(element) {
    if (!element) return element;
    
    const normalized = { ...element };
    const normalizeFunc = getNormalizeCoordinates();
    
    // Normalize start coordinates
    if (normalized.start && typeof normalized.start.x === 'number' && typeof normalized.start.y === 'number') {
        const norm = normalizeFunc(normalized.start.x, normalized.start.y);
        normalized.start = { x: norm.x, y: norm.y };
    }
    
    // Normalize end coordinates
    if (normalized.end && typeof normalized.end.x === 'number' && typeof normalized.end.y === 'number') {
        const norm = normalizeFunc(normalized.end.x, normalized.end.y);
        normalized.end = { x: norm.x, y: norm.y };
    }
    
    // Normalize points array
    if (normalized.points && Array.isArray(normalized.points)) {
        normalized.points = normalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                return normalizeFunc(point.x, point.y);
            }
            return point;
        });
    }
    
    return normalized;
}

// Helper function to denormalize element coordinates
export function denormalizeElement(element) {
    if (!element) return element;
    
    const denormalized = { ...element };
    const denormalizeFunc = getDenormalizeCoordinates();
    
    // Denormalize start coordinates
    if (denormalized.start && typeof denormalized.start.x === 'number' && typeof denormalized.start.y === 'number') {
        // Check if coordinates are normalized (0.0-1.0 range) or already pixels
        // If they're > 1.0, assume they're already pixels (backward compatibility)
        if (denormalized.start.x <= 1.0 && denormalized.start.y <= 1.0) {
            const denorm = denormalizeFunc(denormalized.start.x, denormalized.start.y);
            denormalized.start = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize end coordinates
    if (denormalized.end && typeof denormalized.end.x === 'number' && typeof denormalized.end.y === 'number') {
        if (denormalized.end.x <= 1.0 && denormalized.end.y <= 1.0) {
            const denorm = denormalizeFunc(denormalized.end.x, denormalized.end.y);
            denormalized.end = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize points array
    if (denormalized.points && Array.isArray(denormalized.points)) {
        denormalized.points = denormalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                // Check if normalized (backward compatibility)
                if (point.x <= 1.0 && point.y <= 1.0) {
                    return denormalizeFunc(point.x, point.y);
                }
            }
            return point;
        });
    }
    
    return denormalized;
}

