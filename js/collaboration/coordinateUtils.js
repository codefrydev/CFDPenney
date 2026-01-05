// Coordinate Normalization/Denormalization
import { normalizeCoordinates, denormalizeCoordinates } from '../canvas.js';

// Helper function to normalize element coordinates for sending
export function normalizeElement(element) {
    if (!element) return element;
    
    const normalized = { ...element };
    
    // Normalize start coordinates
    if (normalized.start && typeof normalized.start.x === 'number' && typeof normalized.start.y === 'number') {
        const norm = normalizeCoordinates(normalized.start.x, normalized.start.y);
        normalized.start = { x: norm.x, y: norm.y };
    }
    
    // Normalize end coordinates
    if (normalized.end && typeof normalized.end.x === 'number' && typeof normalized.end.y === 'number') {
        const norm = normalizeCoordinates(normalized.end.x, normalized.end.y);
        normalized.end = { x: norm.x, y: norm.y };
    }
    
    // Normalize points array
    if (normalized.points && Array.isArray(normalized.points)) {
        normalized.points = normalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                return normalizeCoordinates(point.x, point.y);
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
    
    // Denormalize start coordinates
    if (denormalized.start && typeof denormalized.start.x === 'number' && typeof denormalized.start.y === 'number') {
        // Check if coordinates are normalized (0.0-1.0 range) or already pixels
        // If they're > 1.0, assume they're already pixels (backward compatibility)
        if (denormalized.start.x <= 1.0 && denormalized.start.y <= 1.0) {
            const denorm = denormalizeCoordinates(denormalized.start.x, denormalized.start.y);
            denormalized.start = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize end coordinates
    if (denormalized.end && typeof denormalized.end.x === 'number' && typeof denormalized.end.y === 'number') {
        if (denormalized.end.x <= 1.0 && denormalized.end.y <= 1.0) {
            const denorm = denormalizeCoordinates(denormalized.end.x, denormalized.end.y);
            denormalized.end = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize points array
    if (denormalized.points && Array.isArray(denormalized.points)) {
        denormalized.points = denormalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                // Check if normalized (backward compatibility)
                if (point.x <= 1.0 && point.y <= 1.0) {
                    return denormalizeCoordinates(point.x, point.y);
                }
            }
            return point;
        });
    }
    
    return denormalized;
}

