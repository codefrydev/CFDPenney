// Web Platform Adapter
// Implements platform-specific functionality for the web application

import { PlatformAdapter } from './platformAdapter.js';

export class WebAdapter extends PlatformAdapter {
    constructor() {
        super();
        this._showAlertFn = null;
        this._updateConnectionStatusFn = null;
        this._redrawCanvasFn = null;
        this._normalizeCoordinatesFn = null;
        this._denormalizeCoordinatesFn = null;
        this._getCanvasDimensionsFn = null;
        this._discoveryFunctions = null;
        this._urlUtilsFunctions = null;
    }

    /**
     * Initialize the adapter with required functions
     * @param {Object} config - Configuration object with platform-specific functions
     */
    initialize(config) {
        this._showAlertFn = config.showAlert;
        this._updateConnectionStatusFn = config.updateConnectionStatus;
        this._redrawCanvasFn = config.redrawCanvas;
        this._normalizeCoordinatesFn = config.normalizeCoordinates;
        this._denormalizeCoordinatesFn = config.denormalizeCoordinates;
        this._getCanvasDimensionsFn = config.getCanvasDimensions;
        this._discoveryFunctions = config.discovery;
        this._urlUtilsFunctions = config.urlUtils;
    }

    showAlert(message) {
        if (this._showAlertFn) {
            this._showAlertFn(message);
        } else {
            console.error('showAlert not initialized in WebAdapter');
            alert(message);
        }
    }

    updateConnectionStatus(connected, code = null) {
        if (this._updateConnectionStatusFn) {
            this._updateConnectionStatusFn(connected, code);
        } else {
            console.warn('updateConnectionStatus not initialized in WebAdapter');
        }
    }

    normalizeCoordinates(x, y) {
        if (this._normalizeCoordinatesFn) {
            return this._normalizeCoordinatesFn(x, y);
        } else {
            console.error('normalizeCoordinates not initialized in WebAdapter');
            return { x: 0, y: 0 };
        }
    }

    denormalizeCoordinates(normX, normY) {
        if (this._denormalizeCoordinatesFn) {
            return this._denormalizeCoordinatesFn(normX, normY);
        } else {
            console.error('denormalizeCoordinates not initialized in WebAdapter');
            return { x: 0, y: 0 };
        }
    }

    redrawCanvas() {
        if (this._redrawCanvasFn) {
            this._redrawCanvasFn();
        } else {
            console.warn('redrawCanvas not initialized in WebAdapter');
        }
    }

    getCanvasDimensions() {
        if (this._getCanvasDimensionsFn) {
            return this._getCanvasDimensionsFn();
        } else {
            console.error('getCanvasDimensions not initialized in WebAdapter');
            return { width: 0, height: 0 };
        }
    }

    async markSessionConnected(shareCode) {
        if (this._discoveryFunctions && this._discoveryFunctions.markSessionConnected) {
            try {
                await this._discoveryFunctions.markSessionConnected(shareCode);
            } catch (err) {
                console.warn('Failed to mark session as connected:', err);
            }
        }
    }

    async markSessionAvailable(shareCode) {
        if (this._discoveryFunctions && this._discoveryFunctions.markSessionAvailable) {
            try {
                await this._discoveryFunctions.markSessionAvailable(shareCode);
            } catch (err) {
                console.warn('Failed to mark session as available:', err);
            }
        }
    }

    unregisterSession(shareCode) {
        if (this._discoveryFunctions && this._discoveryFunctions.unregisterSession) {
            this._discoveryFunctions.unregisterSession(shareCode);
        }
    }

    async registerSession(shareCode, mode = null, extra = null) {
        if (this._discoveryFunctions && this._discoveryFunctions.registerSession) {
            try {
                await this._discoveryFunctions.registerSession(shareCode, mode, extra);
            } catch (err) {
                console.warn('Failed to register session:', err);
            }
        }
    }

    removeCodeFromURL() {
        if (this._urlUtilsFunctions && this._urlUtilsFunctions.removeCodeFromURL) {
            this._urlUtilsFunctions.removeCodeFromURL();
        }
    }
}

// Create singleton instance
export const webAdapter = new WebAdapter();
