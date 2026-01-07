// Preload Script - Secure IPC Bridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Overlay mode control
    toggleOverlayMode: (mode) => ipcRenderer.send('toggle-overlay-mode', mode),
    onOverlayModeChanged: (callback) => ipcRenderer.on('overlay-mode-changed', (event, mode) => callback(mode)),
    
    // Desktop capturer
    getSources: () => ipcRenderer.invoke('get-sources'),
    getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
    
    // Overlay events (from main window to overlay)
    onRemotePointerMove: (callback) => ipcRenderer.on('remote-pointer-move', (event, data) => callback(data)),
    onRemoteStrokeStart: (callback) => ipcRenderer.on('remote-stroke-start', (event, data) => callback(data)),
    onRemoteStrokeMove: (callback) => ipcRenderer.on('remote-stroke-move', (event, data) => callback(data)),
    onRemoteStrokeEnd: (callback) => ipcRenderer.on('remote-stroke-end', (event, data) => callback(data)),
    onClearOverlay: (callback) => ipcRenderer.on('clear-overlay', (event) => callback()),
    
    // Overlay events (from overlay to main window for broadcasting)
    sendOverlayEvent: (data) => ipcRenderer.send('overlay-event', data),
    onOverlayEvent: (callback) => ipcRenderer.on('overlay-event', (event, data) => callback(data)),
    
    // Pointer forwarding (from main window to overlay)
    sendPointerMove: (data) => ipcRenderer.send('pointer-move', data),
    sendStrokeStart: (data) => ipcRenderer.send('stroke-start', data),
    sendStrokeMove: (data) => ipcRenderer.send('stroke-move', data),
    sendStrokeEnd: (data) => ipcRenderer.send('stroke-end', data),
    sendClearOverlay: () => ipcRenderer.send('clear-overlay'),
    
    // Bounds changes
    onBoundsChanged: (callback) => ipcRenderer.on('bounds-changed', (event, data) => callback(data)),
    
    // Screen dimensions (for coordinate mapping)
    onScreenDimensions: (callback) => ipcRenderer.on('screen-dimensions', (event, data) => callback(data)),
    
    // Video dimensions (for coordinate mapping - actual shared screen resolution)
    sendVideoDimensions: (width, height) => ipcRenderer.send('video-dimensions', { width, height }),
    onVideoDimensions: (callback) => ipcRenderer.on('video-dimensions', (event, data) => callback(data)),
    
    // Cleanup
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

