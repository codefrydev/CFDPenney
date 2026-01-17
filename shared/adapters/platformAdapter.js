// Platform Adapter Interface
// Defines the contract that platform-specific adapters must implement
// This allows shared collaboration code to work across web and desktop platforms

/**
 * Base Platform Adapter Interface
 * All platform-specific adapters should implement these methods
 */
export class PlatformAdapter {
    /**
     * Show an alert message to the user
     * @param {string} message - The message to display
     */
    showAlert(message) {
        throw new Error('showAlert() must be implemented by platform adapter');
    }

    /**
     * Update the connection status UI
     * @param {boolean} connected - Whether currently connected
     * @param {string|null} code - The share code (if hosting)
     */
    updateConnectionStatus(connected, code = null) {
        throw new Error('updateConnectionStatus() must be implemented by platform adapter');
    }

    /**
     * Normalize coordinates from pixel to 0.0-1.0 range
     * @param {number} x - X coordinate in pixels
     * @param {number} y - Y coordinate in pixels
     * @returns {{x: number, y: number}} Normalized coordinates
     */
    normalizeCoordinates(x, y) {
        throw new Error('normalizeCoordinates() must be implemented by platform adapter');
    }

    /**
     * Denormalize coordinates from 0.0-1.0 range to pixels
     * @param {number} normX - Normalized X coordinate
     * @param {number} normY - Normalized Y coordinate
     * @returns {{x: number, y: number}} Pixel coordinates
     */
    denormalizeCoordinates(normX, normY) {
        throw new Error('denormalizeCoordinates() must be implemented by platform adapter');
    }

    /**
     * Redraw the canvas
     */
    redrawCanvas() {
        throw new Error('redrawCanvas() must be implemented by platform adapter');
    }

    /**
     * Get canvas dimensions
     * @returns {{width: number, height: number}} Canvas dimensions
     */
    getCanvasDimensions() {
        throw new Error('getCanvasDimensions() must be implemented by platform adapter');
    }

    /**
     * Mark session as connected in discovery service (web only)
     * @param {string} shareCode - The share code
     * @returns {Promise<void>}
     */
    async markSessionConnected(shareCode) {
        // Optional - desktop doesn't use discovery service
    }

    /**
     * Mark session as available in discovery service (web only)
     * @param {string} shareCode - The share code
     * @returns {Promise<void>}
     */
    async markSessionAvailable(shareCode) {
        // Optional - desktop doesn't use discovery service
    }

    /**
     * Unregister session from discovery service (web only)
     * @param {string} shareCode - The share code
     */
    unregisterSession(shareCode) {
        // Optional - desktop doesn't use discovery service
    }

    /**
     * Register session with discovery service (web only)
     * @param {string} shareCode - The share code
     * @param {string|null} mode - The mode (optional)
     * @param {string|null} extra - Extra data (optional)
     * @returns {Promise<void>}
     */
    async registerSession(shareCode, mode = null, extra = null) {
        // Optional - desktop doesn't use discovery service
    }

    /**
     * Remove code from URL (web only)
     */
    removeCodeFromURL() {
        // Optional - desktop doesn't use URLs
    }

    /**
     * Update participants panel
     */
    updateParticipantsPanel() {
        // Optional - can be implemented by platform if needed
        if (typeof window !== 'undefined' && window.updateParticipantsPanel) {
            window.updateParticipantsPanel();
        }
    }

    /**
     * Initialize chat (if available)
     */
    initChat() {
        // Optional - can be implemented by platform if needed
        if (typeof window !== 'undefined' && window.initChat) {
            window.initChat();
        }
    }
}
