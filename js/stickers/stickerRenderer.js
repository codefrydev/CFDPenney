// Sticker Rendering Functions
// Provides functions to render stickers (emoji, icons, images) on canvas
import { redrawCanvas } from '../canvas.js';

/**
 * Render an emoji sticker
 */
export function renderEmoji(ctx, element) {
    if (!element.stickerData) return;
    
    const fontSize = element.width * 8 || 32; // Scale emoji size
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = element.color || '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = element.start.x;
    const centerY = element.start.y;
    
    ctx.fillText(element.stickerData, centerX, centerY);
}

/**
 * Render an icon sticker (using Lucide icons as text/SVG)
 * Note: This is a simplified version. For full SVG support, you'd need to load SVG files
 */
export function renderIcon(ctx, element) {
    if (!element.stickerData) return;
    
    // For now, we'll render icons as text or use a placeholder
    // In a full implementation, you'd load the SVG and render it
    const fontSize = element.width * 6 || 24;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = element.color || '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const centerX = element.start.x;
    const centerY = element.start.y;
    
    // Placeholder: render icon name or use a symbol
    // In production, you'd load the actual SVG icon
    ctx.fillText('●', centerX, centerY);
}

/**
 * Render an image sticker
 */
export function renderImage(ctx, element) {
    if (!element.stickerData) return;
    
    const img = new Image();
    img.onload = () => {
        const size = element.width * 10 || 40;
        const halfSize = size / 2;
        ctx.drawImage(
            img,
            element.start.x - halfSize,
            element.start.y - halfSize,
            size,
            size
        );
        // Trigger redraw
        redrawCanvas();
    };
    img.onerror = () => {
        console.error('Failed to load sticker image:', element.stickerData);
    };
    img.src = element.stickerData;
    
    // If image is already loaded, draw it immediately
    if (img.complete) {
        const size = element.width * 10 || 40;
        const halfSize = size / 2;
        ctx.drawImage(
            img,
            element.start.x - halfSize,
            element.start.y - halfSize,
            size,
            size
        );
    }
}

/**
 * Render a sticker element based on its type
 */
export function renderSticker(ctx, element) {
    if (!element.stickerType || !element.stickerData) return;
    
    switch (element.stickerType) {
        case 'emoji':
            renderEmoji(ctx, element);
            break;
        case 'icon':
            renderIcon(ctx, element);
            break;
        case 'image':
            renderImage(ctx, element);
            break;
        default:
    }
}

