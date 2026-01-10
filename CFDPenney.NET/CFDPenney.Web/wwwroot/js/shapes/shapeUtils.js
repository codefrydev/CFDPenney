// Shape Calculation Utilities
// Provides helper functions for calculating shape points, bounding boxes, and geometric properties

/**
 * Calculate bounding box from start and end points
 */
export function getBoundingBox(start, end) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}

/**
 * Calculate circle radius from bounding box
 */
export function getCircleRadius(start, end) {
    const bbox = getBoundingBox(start, end);
    return Math.min(bbox.width, bbox.height) / 2;
}

/**
 * Calculate center point from start and end
 */
export function getCenter(start, end) {
    return {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
    };
}

/**
 * Calculate distance between two points
 */
export function getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate radius from center and edge point
 */
export function getRadiusFromCenter(center, edge) {
    return getDistance(center, edge);
}

/**
 * Generate points for a regular polygon
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} radius - Radius of the polygon
 * @param {number} sides - Number of sides
 * @param {number} rotation - Rotation angle in radians (default: 0)
 * @returns {Array} Array of {x, y} points
 */
export function getPolygonPoints(centerX, centerY, radius, sides, rotation = 0) {
    const points = [];
    const angleStep = (2 * Math.PI) / sides;
    
    for (let i = 0; i < sides; i++) {
        const angle = i * angleStep + rotation;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push({ x, y });
    }
    
    return points;
}

/**
 * Generate points for a star shape
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} outerRadius - Outer radius of the star
 * @param {number} innerRadius - Inner radius of the star
 * @param {number} points - Number of star points
 * @param {number} rotation - Rotation angle in radians (default: 0)
 * @returns {Array} Array of {x, y} points
 */
export function getStarPoints(centerX, centerY, outerRadius, innerRadius, points, rotation = 0) {
    const starPoints = [];
    const angleStep = (2 * Math.PI) / points;
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * angleStep) / 2 + rotation;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        starPoints.push({ x, y });
    }
    
    return starPoints;
}

/**
 * Calculate triangle points (equilateral from bounding box)
 * Anchored to start point like rectangle - triangle fits within bounding box
 */
export function getTrianglePoints(start, end) {
    const bbox = getBoundingBox(start, end);
    const size = Math.min(bbox.width, bbox.height);
    
    // Equilateral triangle pointing up, fits within bounding box
    // Top point at center X, top Y of bounding box
    // Bottom points at bottom corners of square within bounding box
    return [
        { x: bbox.x + size / 2, y: bbox.y },                    // Top point
        { x: bbox.x, y: bbox.y + size },                      // Bottom left
        { x: bbox.x + size, y: bbox.y + size }                // Bottom right
    ];
}

/**
 * Calculate diamond points from bounding box
 * Anchored to start point like rectangle
 */
export function getDiamondPoints(start, end) {
    const bbox = getBoundingBox(start, end);
    const centerX = bbox.centerX;
    const centerY = bbox.centerY;
    const halfWidth = bbox.width / 2;
    const halfHeight = bbox.height / 2;
    
    // Diamond points centered in bounding box
    // This ensures the diamond fits within the bounding box anchored to start point
    return [
        { x: centerX, y: bbox.y },                    // Top
        { x: bbox.x + bbox.width, y: centerY },       // Right
        { x: centerX, y: bbox.y + bbox.height },     // Bottom
        { x: bbox.x, y: centerY }                     // Left
    ];
}

/**
 * Check if a point is inside a polygon
 * Uses ray casting algorithm
 */
export function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Check if a point is inside a circle
 */
export function isPointInCircle(point, center, radius) {
    const distance = getDistance(point, center);
    return distance <= radius;
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRect(point, start, end) {
    const bbox = getBoundingBox(start, end);
    return point.x >= bbox.x && point.x <= bbox.x + bbox.width &&
           point.y >= bbox.y && point.y <= bbox.y + bbox.height;
}

