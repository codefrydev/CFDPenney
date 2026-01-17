// Coordinate Normalization/Denormalization for Electron Overlay

// Normalize coordinates from pixel to 0.0-1.0 range
export function normalizeCoordinates(x, y, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return { x: 0, y: 0 };
    return {
        x: canvasWidth > 0 ? x / canvasWidth : 0,
        y: canvasHeight > 0 ? y / canvasHeight : 0
    };
}

// Denormalize coordinates from 0.0-1.0 range to pixel coordinates
export function denormalizeCoordinates(normX, normY, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return { x: 0, y: 0 };
    return {
        x: normX * canvasWidth,
        y: normY * canvasHeight
    };
}

// Helper function to normalize element coordinates for sending
export function normalizeElement(element, canvasWidth, canvasHeight) {
    if (!element) return element;
    
    const normalized = { ...element };
    
    // Normalize start coordinates
    if (normalized.start && typeof normalized.start.x === 'number' && typeof normalized.start.y === 'number') {
        const norm = normalizeCoordinates(normalized.start.x, normalized.start.y, canvasWidth, canvasHeight);
        normalized.start = { x: norm.x, y: norm.y };
    }
    
    // Normalize end coordinates
    if (normalized.end && typeof normalized.end.x === 'number' && typeof normalized.end.y === 'number') {
        const norm = normalizeCoordinates(normalized.end.x, normalized.end.y, canvasWidth, canvasHeight);
        normalized.end = { x: norm.x, y: norm.y };
    }
    
    // Normalize points array
    if (normalized.points && Array.isArray(normalized.points)) {
        normalized.points = normalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                return normalizeCoordinates(point.x, point.y, canvasWidth, canvasHeight);
            }
            return point;
        });
    }
    
    return normalized;
}

// Helper function to denormalize element coordinates
export function denormalizeElement(element, canvasWidth, canvasHeight) {
    if (!element) return element;
    
    const denormalized = { ...element };
    
    // Denormalize start coordinates
    if (denormalized.start && typeof denormalized.start.x === 'number' && typeof denormalized.start.y === 'number') {
        // Check if coordinates are normalized (0.0-1.0 range) or already pixels
        if (denormalized.start.x <= 1.0 && denormalized.start.y <= 1.0) {
            const denorm = denormalizeCoordinates(denormalized.start.x, denormalized.start.y, canvasWidth, canvasHeight);
            denormalized.start = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize end coordinates
    if (denormalized.end && typeof denormalized.end.x === 'number' && typeof denormalized.end.y === 'number') {
        if (denormalized.end.x <= 1.0 && denormalized.end.y <= 1.0) {
            const denorm = denormalizeCoordinates(denormalized.end.x, denormalized.end.y, canvasWidth, canvasHeight);
            denormalized.end = { x: denorm.x, y: denorm.y };
        }
    }
    
    // Denormalize points array
    if (denormalized.points && Array.isArray(denormalized.points)) {
        denormalized.points = denormalized.points.map(point => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                // Check if normalized
                if (point.x <= 1.0 && point.y <= 1.0) {
                    return denormalizeCoordinates(point.x, point.y, canvasWidth, canvasHeight);
                }
            }
            return point;
        });
    }
    
    return denormalized;
}

