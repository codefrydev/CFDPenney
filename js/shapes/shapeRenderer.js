// Shape Rendering Functions
// Provides functions to render various geometric shapes on canvas
import { getBoundingBox, getCenter, getCircleRadius, getPolygonPoints, getStarPoints, getTrianglePoints, getDiamondPoints } from './shapeUtils.js';

/**
 * Draw a circle
 * Simple and direct implementation - follows rectangle pattern
 */
export function drawCircle(ctx, element) {
    const bbox = getBoundingBox(element.start, element.end);
    const centerX = bbox.centerX;
    const centerY = bbox.centerY;
    const radius = getCircleRadius(element.start, element.end);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Draw an ellipse
 * Simple and direct implementation - follows rectangle pattern
 */
export function drawEllipse(ctx, element) {
    const bbox = getBoundingBox(element.start, element.end);
    const centerX = bbox.centerX;
    const centerY = bbox.centerY;
    const radiusX = bbox.width / 2;
    const radiusY = bbox.height / 2;
    
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Draw a line
 * Simple and direct implementation - follows rectangle pattern
 */
export function drawLine(ctx, element) {
    ctx.beginPath();
    ctx.moveTo(element.start.x, element.start.y);
    ctx.lineTo(element.end.x, element.end.y);
    
    // Draw stroke (lines don't have fill)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

/**
 * Draw a rectangle
 * Simple and direct implementation - uses native canvas rect methods
 */
export function drawRect(ctx, element) {
    const bbox = getBoundingBox(element.start, element.end);
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fillRect(bbox.x, bbox.y, bbox.width, bbox.height);
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
    }
}

/**
 * Draw a triangle
 * Simple and direct implementation - follows rectangle pattern
 */
export function drawTriangle(ctx, element) {
    const points = getTrianglePoints(element.start, element.end);
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Draw a diamond
 * Simple and direct implementation - follows rectangle pattern
 */
export function drawDiamond(ctx, element) {
    const points = getDiamondPoints(element.start, element.end);
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Draw a star
 * Simple and direct implementation - follows rectangle pattern
 * Anchored to start point like rectangle
 */
export function drawStar(ctx, element) {
    const bbox = getBoundingBox(element.start, element.end);
    const centerX = bbox.centerX;
    const centerY = bbox.centerY;
    const size = Math.min(bbox.width, bbox.height);
    const radius = size / 2;
    const innerRadius = radius * 0.4; // Inner radius is 40% of outer
    const points = 5; // 5-pointed star
    
    // Star is centered in bounding box, ensuring it fits within the box anchored to start point
    const starPoints = getStarPoints(centerX, centerY, radius, innerRadius, points, element.rotation || 0);
    
    ctx.beginPath();
    ctx.moveTo(starPoints[0].x, starPoints[0].y);
    for (let i = 1; i < starPoints.length; i++) {
        ctx.lineTo(starPoints[i].x, starPoints[i].y);
    }
    ctx.closePath();
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Draw a regular polygon
 * Simple and direct implementation - follows rectangle pattern
 * Anchored to start point like rectangle
 */
export function drawPolygon(ctx, element) {
    const bbox = getBoundingBox(element.start, element.end);
    const centerX = bbox.centerX;
    const centerY = bbox.centerY;
    const size = Math.min(bbox.width, bbox.height);
    const radius = size / 2;
    const sides = element.sides || 5;
    
    // Polygon is centered in bounding box, ensuring it fits within the box anchored to start point
    const polygonPoints = getPolygonPoints(centerX, centerY, radius, sides, element.rotation || 0);
    
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
    for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
    }
    ctx.closePath();
    
    // Draw fill first (if enabled)
    if (element.filled && element.fillColor) {
        ctx.fillStyle = element.fillColor;
        ctx.fill();
    }
    
    // Draw stroke (always draw if color is set)
    if (element.color) {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.width || 2;
        ctx.stroke();
    }
}

/**
 * Render a shape element based on its type
 */
export function renderShape(ctx, element) {
    switch (element.type) {
        case 'circle':
            drawCircle(ctx, element);
            break;
        case 'ellipse':
            drawEllipse(ctx, element);
            break;
        case 'line':
            drawLine(ctx, element);
            break;
        case 'rect':
            drawRect(ctx, element);
            break;
        case 'triangle':
            drawTriangle(ctx, element);
            break;
        case 'diamond':
            drawDiamond(ctx, element);
            break;
        case 'star':
            drawStar(ctx, element);
            break;
        case 'pentagon':
            drawPolygon(ctx, { ...element, sides: 5 });
            break;
        case 'hexagon':
            drawPolygon(ctx, { ...element, sides: 6 });
            break;
        case 'octagon':
            drawPolygon(ctx, { ...element, sides: 8 });
            break;
        default:
            console.warn(`Unknown shape type: ${element.type}`);
    }
}

