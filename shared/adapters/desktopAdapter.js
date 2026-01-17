// Desktop Platform Adapter
// Implements platform-specific functionality for the Electron desktop application

import { PlatformAdapter } from './platformAdapter.js';

export class DesktopAdapter extends PlatformAdapter {
    constructor() {
        super();
    }

    showAlert(message) {
        if (typeof window !== 'undefined' && window.showAlert) {
            window.showAlert(message);
        } else {
            console.error('window.showAlert not available');
            alert(message);
        }
    }

    updateConnectionStatus(connected, code = null) {
        if (typeof window !== 'undefined' && window.updateConnectionStatus) {
            window.updateConnectionStatus(connected, code);
        } else {
            console.warn('window.updateConnectionStatus not available');
        }
    }

    normalizeCoordinates(x, y) {
        // Desktop uses simple pixel-based coordinates
        // Get canvas dimensions for normalization
        const dimensions = this.getCanvasDimensions();
        if (!dimensions.width || !dimensions.height) {
            return { x: 0, y: 0 };
        }
        return {
            x: dimensions.width > 0 ? x / dimensions.width : 0,
            y: dimensions.height > 0 ? y / dimensions.height : 0
        };
    }

    denormalizeCoordinates(normX, normY) {
        // Desktop uses simple pixel-based coordinates
        const dimensions = this.getCanvasDimensions();
        if (!dimensions.width || !dimensions.height) {
            return { x: 0, y: 0 };
        }
        return {
            x: normX * dimensions.width,
            y: normY * dimensions.height
        };
    }

    redrawCanvas() {
        // Desktop overlay redraws automatically via requestAnimationFrame
        // No explicit redraw needed
    }

    getCanvasDimensions() {
        // Get canvas dimensions from the overlay canvas
        if (typeof window !== 'undefined' && window.overlayCanvas) {
            return {
                width: window.overlayCanvas.width,
                height: window.overlayCanvas.height
            };
        } else if (typeof document !== 'undefined') {
            const canvas = document.getElementById('overlay-canvas');
            if (canvas) {
                return {
                    width: canvas.width,
                    height: canvas.height
                };
            }
        }
        return { width: 0, height: 0 };
    }

    // Discovery service methods are no-ops for desktop
    async markSessionConnected(shareCode) {
        // Desktop doesn't use discovery service
    }

    async markSessionAvailable(shareCode) {
        // Desktop doesn't use discovery service
    }

    unregisterSession(shareCode) {
        // Desktop doesn't use discovery service
    }

    async registerSession(shareCode, mode = null, extra = null) {
        // Desktop doesn't use discovery service
    }

    removeCodeFromURL() {
        // Desktop doesn't use URLs
    }
}

// Create singleton instance
export const desktopAdapter = new DesktopAdapter();
