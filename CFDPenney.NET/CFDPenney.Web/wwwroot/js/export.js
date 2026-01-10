// Export/Snapshot Functionality
import { state } from './state.js';
import { getCanvas } from './canvas.js';

let videoElem = null;

export function initExport(videoEl) {
    videoElem = videoEl;
}

function drawAnnotationsAndSave(tempCanvas, tCtx) {
    const canvas = getCanvas();
    if (!canvas) return;
    
    // Draw current canvas on top
    tCtx.drawImage(canvas, 0, 0);
    
    // Download
    const link = document.createElement('a');
    link.download = `annotation-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
}

export function downloadSnapshot() {
    const canvas = getCanvas();
    if (!canvas) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');

    // 1. Draw Background
    if (state.mode === 'whiteboard') {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        tCtx.fillStyle = theme === 'dark' ? '#1f2937' : '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        drawAnnotationsAndSave(tempCanvas, tCtx);
    } 
    else if (state.mode === 'screen' && videoElem && videoElem.srcObject) {
        const vRatio = tempCanvas.width / videoElem.videoWidth;
        const hRatio = tempCanvas.height / videoElem.videoHeight;
        const ratio = Math.min(vRatio, hRatio);
        const centerShift_x = (tempCanvas.width - videoElem.videoWidth * ratio) / 2;
        const centerShift_y = (tempCanvas.height - videoElem.videoHeight * ratio) / 2;

        tCtx.drawImage(videoElem, 0, 0, videoElem.videoWidth, videoElem.videoHeight,
                       centerShift_x, centerShift_y, videoElem.videoWidth * ratio, videoElem.videoHeight * ratio);
        drawAnnotationsAndSave(tempCanvas, tCtx);
    } 
    else if (state.mode === 'image' && state.backgroundImageSrc) {
        const img = new Image();
        img.onload = () => {
            const hRatio = tempCanvas.width / img.width;
            const vRatio = tempCanvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShift_x = (tempCanvas.width - img.width * ratio) / 2;
            const centerShift_y = (tempCanvas.height - img.height * ratio) / 2;
            
            tCtx.drawImage(img, 0, 0, img.width, img.height,
                           centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
            drawAnnotationsAndSave(tempCanvas, tCtx);
        };
        img.src = state.backgroundImageSrc;
    } else {
        // Fallback (e.g. empty image mode)
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        tCtx.fillStyle = theme === 'dark' ? '#111827' : '#f9fafb';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        drawAnnotationsAndSave(tempCanvas, tCtx);
    }
}

