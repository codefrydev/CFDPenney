// Electron Main Process
const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let overlayWindow = null;
let isOverlayInteractive = false;

// Get the correct app path (works in both dev and packaged)
function getAppPath() {
    // In development, use __dirname
    // In production, use app.getAppPath() which handles asar correctly
    if (app.isPackaged) {
        return app.getAppPath();
    }
    return __dirname;
}

// Get path to a file (handles asar unpacking if needed)
function getFilePath(filename) {
    const appPath = getAppPath();
    const filePath = path.join(appPath, filename);
    
    // Check if file exists, if not and we're in asar, try unpacked location
    if (app.isPackaged && !fs.existsSync(filePath)) {
        // Try unpacked location (for files that can't be in asar)
        const unpackedPath = filePath.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpackedPath)) {
            return unpackedPath;
        }
    }
    
    return filePath;
}

// Create main window
function createMainWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    const preloadPath = getFilePath('preload.js');
    
    mainWindow = new BrowserWindow({
        width: Math.floor(width * 0.8),
        height: Math.floor(height * 0.8),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        },
        title: 'Annonate - Screen Share',
        backgroundColor: '#1a1a1a'
    });
    
    // Set window icon
    const iconPath = getFilePath('build/icon.png');
    if (fs.existsSync(iconPath)) {
        mainWindow.setIcon(iconPath);
    }
    
    const screenHtmlPath = getFilePath('screen.html');
    mainWindow.loadFile(screenHtmlPath);
    
    // Open DevTools in development
    if (process.argv.includes('--inspect')) {
        mainWindow.webContents.openDevTools();
    }
    
    // Create overlay when main window is ready
    mainWindow.webContents.on('did-finish-load', () => {
        createOverlayWindow();
    });
    
    // Sync overlay on window move/resize
    mainWindow.on('move', syncOverlayBounds);
    mainWindow.on('resize', syncOverlayBounds);
    mainWindow.on('moved', syncOverlayBounds);
    mainWindow.on('resized', syncOverlayBounds);
    
    // Handle main window close
    mainWindow.on('closed', () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close();
        }
        mainWindow = null;
        overlayWindow = null;
    });
}

// Create transparent overlay window
function createOverlayWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const bounds = mainWindow.getBounds();
    
    const preloadPath = getFilePath('preload.js');
    const overlayHtmlPath = getFilePath('overlay.html');
    
    overlayWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        },
        hasShadow: false
    });
    
    overlayWindow.loadFile(overlayHtmlPath);
    
    // Start in view mode (click-through)
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    
    // Open DevTools in development
    if (process.argv.includes('--inspect')) {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }
    
    // Prevent overlay from being closed accidentally
    overlayWindow.on('close', (e) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            e.preventDefault();
        }
    });
}

// Sync overlay window bounds with main window
function syncOverlayBounds() {
    if (!mainWindow || !overlayWindow || mainWindow.isDestroyed() || overlayWindow.isDestroyed()) {
        return;
    }
    
    const bounds = mainWindow.getBounds();
    const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
    
    overlayWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
    });
    
    // Notify overlay of bounds change
    overlayWindow.webContents.send('bounds-changed', { bounds, scaleFactor });
}

// IPC Handlers

// Toggle overlay mode (view/draw)
ipcMain.on('toggle-overlay-mode', (event, mode) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    
    isOverlayInteractive = mode === 'draw';
    
    if (isOverlayInteractive) {
        // Draw mode - capture mouse events
        overlayWindow.setIgnoreMouseEvents(false);
    } else {
        // View mode - click-through
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    
    // Notify overlay of mode change
    overlayWindow.webContents.send('overlay-mode-changed', mode);
});

// Forward pointer events from main window to overlay
ipcMain.on('pointer-move', (event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('remote-pointer-move', data);
    }
});

// Forward stroke events from main window to overlay
ipcMain.on('stroke-start', (event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('remote-stroke-start', data);
    }
});

ipcMain.on('stroke-move', (event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('remote-stroke-move', data);
    }
});

ipcMain.on('stroke-end', (event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('remote-stroke-end', data);
    }
});

ipcMain.on('clear-overlay', (event) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('clear-overlay');
    }
});

// Get available desktop sources
ipcMain.handle('get-sources', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 150, height: 150 }
        });
        return sources.map(source => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL()
        }));
    } catch (error) {
        console.error('Error getting sources:', error);
        return [];
    }
});

// Get display info for DPI scaling
ipcMain.handle('get-display-info', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
        scaleFactor: primaryDisplay.scaleFactor,
        bounds: primaryDisplay.bounds,
        workArea: primaryDisplay.workArea
    };
});

// Send overlay event to main window (for broadcasting)
ipcMain.on('overlay-event', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('overlay-event', data);
    }
});

// App lifecycle
app.whenReady().then(() => {
    createMainWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle cleanup
app.on('before-quit', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.destroy();
    }
});
