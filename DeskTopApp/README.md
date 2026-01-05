# Annonate Electron - Screen Sharing with Transparent Overlay

A Zoom/Slack-like screen sharing system with **real transparent overlay** for pointers and annotations built with Electron.js and WebRTC.

## Architecture Overview

The system uses a dual-window architecture to achieve true transparency over shared screens:

```
┌─────────────────────────────┐
│   Main Window (screen.html) │
│   ┌─────────────────────┐   │
│   │  <video> stream     │   │  ← Displays shared screen
│   └─────────────────────┘   │
└─────────────────────────────┘
         ↓ aligned & synced
┌─────────────────────────────┐
│ Overlay Window (overlay.html)│
│  ┌─────────────────────┐    │
│  │  <canvas> pointers  │    │  ← Transparent, always-on-top
│  │  + annotations      │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### Key Components

1. **Main Window** (`screen.html`, `screen.js`)
   - Screen/window capture via `desktopCapturer`
   - Video stream display
   - WebRTC peer connection management
   - Session hosting/joining UI

2. **Overlay Window** (`overlay.html`, `overlay.js`)
   - Transparent, frameless `BrowserWindow`
   - Canvas for pointer and annotation rendering
   - Click-through toggle (view/draw modes)
   - Real-time coordinate normalization

3. **Main Process** (`main.js`)
   - Window creation and management
   - Overlay synchronization (position, size, DPI)
   - IPC communication between windows
   - Multi-monitor support

4. **Collaboration System** (`collaboration/`)
   - PeerJS-based WebRTC connections
   - Event broadcasting (pointer, strokes)
   - Coordinate normalization for cross-resolution compatibility

## Why Separate Windows?

**Critical Design Decision**: The overlay is NOT embedded in the video frame or canvas. Instead, it's a separate transparent window that sits on top of the main window. This approach:

- ✅ Works with any screen/window being shared
- ✅ Maintains full resolution without re-encoding
- ✅ Allows true transparency and click-through
- ✅ Separates concerns (screen capture vs annotation)
- ✅ Enables independent rendering pipelines

Embedding overlays in video frames would:
- ❌ Require re-encoding the video stream
- ❌ Degrade quality
- ❌ Increase latency
- ❌ Consume more CPU/GPU

## How Overlay Synchronization Works

The overlay window stays perfectly aligned with the main window through:

1. **Position & Size Sync**: Main window emits `move` and `resize` events that update the overlay bounds
2. **DPI Scaling**: Canvas accounts for `devicePixelRatio` for crisp rendering
3. **Multi-monitor**: Uses `screen.getPrimaryDisplay()` for correct positioning

```javascript
// In main.js
mainWindow.on('move', syncOverlayBounds);
mainWindow.on('resize', syncOverlayBounds);

function syncOverlayBounds() {
    const bounds = mainWindow.getBounds();
    overlayWindow.setBounds(bounds);
}
```

## Coordinate Normalization

All pointer/stroke coordinates are normalized (0.0 - 1.0) before transmission to support different screen resolutions:

**Sender Side** (overlay.js):
```javascript
// Convert pixel → normalized
const normalized = normalizeCoordinates(x, y, canvasWidth, canvasHeight);
// nx = x / canvasWidth, ny = y / canvasHeight
```

**Receiver Side** (messageHandler.js):
```javascript
// Convert normalized → pixel
const denorm = denormalizeCoordinates(nx, ny, canvasWidth, canvasHeight);
// x = nx * canvasWidth, y = ny * canvasHeight
```

This ensures that a pointer at 50% width on a 1920px screen appears at 50% width on a 1280px screen.

## Event Transport

Events are sent via WebRTC data channels (not embedded in video):

### Pointer Events
```javascript
{
  type: 'POINTER_MOVE',
  nx: 0.5,        // Normalized X (0-1)
  ny: 0.3,        // Normalized Y (0-1)
  peerId: 'ABC123'
}
```

### Stroke Events
```javascript
// Start drawing
{
  type: 'STROKE_START',
  id: 'stroke-123',
  tool: 'pencil',
  color: '#FF3B30',
  width: 4,
  nx: 0.5,
  ny: 0.3,
  peerId: 'ABC123'
}

// Continue drawing
{
  type: 'STROKE_MOVE',
  id: 'stroke-123',
  nx: 0.51,
  ny: 0.31
}

// Finish drawing
{
  type: 'STROKE_END',
  id: 'stroke-123'
}
```

### Clear Overlay
```javascript
{
  type: 'CLEAR_OVERLAY'
}
```

## Click-Through Toggle

The overlay supports two modes:

**View Mode** (default):
- Click-through enabled: `setIgnoreMouseEvents(true)`
- Pointer events pass through to underlying windows
- Only displays remote pointers/annotations
- Keyboard shortcuts active

**Draw Mode**:
- Click-through disabled: `setIgnoreMouseEvents(false)`
- Captures mouse input for drawing
- Local annotations sent to peers

Toggle with keyboard shortcuts:
- `P` - Pointer mode (view)
- `D` - Draw mode
- `Esc` - Back to view mode

## Performance Optimizations

### Pointer Throttling
Pointer events are throttled to ~60fps (16ms) to reduce network traffic:
```javascript
const POINTER_THROTTLE_MS = 16;
if (now - lastPointerSendTime > POINTER_THROTTLE_MS) {
    sendPointerEvent();
}
```

### Canvas Rendering
Uses `requestAnimationFrame` for smooth 60fps rendering:
```javascript
function render() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    renderStrokes();
    renderPointers();
    requestAnimationFrame(render);
}
```

### DPI Scaling
Canvas accounts for high-DPI displays:
```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = canvasWidth * dpr;
canvas.height = canvasHeight * dpr;
ctx.scale(dpr, dpr);
```

## Installation & Usage

### Install Dependencies
```bash
cd DeskTopApp
npm install
```

### Run the App
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Usage Flow

1. **Start the App**: Click "Select Screen" to choose what to share
2. **Begin Sharing**: Click "Start Sharing" to capture the selected screen/window
3. **Host a Session**: Click "Host Session" to generate a 5-character share code
4. **Join a Session**: Enter a share code and click "Join Session"
5. **Use Overlay**: 
   - Press `P` for pointer mode (view only)
   - Press `D` for draw mode (annotate)
   - Press `H` to see all shortcuts
   - Press `Ctrl+C` to clear annotations

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Pointer mode (view, click-through) |
| `D` | Draw mode (interactive) |
| `C` (with Ctrl/Cmd) | Clear all annotations |
| `Esc` | Back to pointer mode |
| `H` | Show/hide shortcuts help |

## Multi-User Collaboration

- **Host**: Generates a share code, accepts multiple joiners
- **Joiners**: Connect to host via share code
- **Everyone can**: Point and draw on the shared screen
- **Color coding**: Each peer has a unique color based on their peer ID
- **Real-time sync**: All events broadcasted via WebRTC data channels

## Debugging Tips

### DevTools
Run with `--inspect` to open DevTools:
```bash
npm run dev
```

### Console Logs
Check for:
- `[PeerJS]` - Connection status
- `[Connection]` - Data channel lifecycle
- `[Call]` - Video stream events
- Canvas resize logs

### Common Issues

**Overlay not aligned:**
- Check DPI scaling: `console.log(window.devicePixelRatio)`
- Verify bounds sync: `syncOverlayBounds()` being called

**Pointer not visible:**
- Ensure WebRTC data channel is open
- Check coordinate normalization (should be 0-1)
- Verify overlay mode (must receive events in any mode)

**Can't draw:**
- Press `D` to enter draw mode
- Check overlay window focus
- Verify IPC bridge is working

**Peer not connecting:**
- Check STUN/TURN servers in `collaborationCore.js`
- Verify firewall/NAT settings
- Try different network (some networks block WebRTC)

### IPC Communication Flow

```
Overlay Window                Main Process              Main Window
     │                             │                         │
     │  overlay-event              │                         │
     ├────────────────────────────>│                         │
     │                             │  overlay-event          │
     │                             ├────────────────────────>│
     │                             │                         │
     │                             │    (broadcasts via      │
     │                             │     WebRTC to peers)    │
     │                             │                         │
     │  remote-pointer-move        │  pointer-move           │
     │<────────────────────────────┤<────────────────────────┤
     │                             │                         │
```

## File Structure

```
DeskTopApp/
├── main.js                  # Electron main process
├── preload.js               # IPC bridge (secure)
├── package.json             # Dependencies
├── screen.html              # Main window UI
├── screen.js                # Screen capture + WebRTC
├── overlay.html             # Overlay window UI
├── overlay.js               # Pointer + annotation engine
├── state.js                 # Shared state management
├── collaboration/           # WebRTC collaboration
│   ├── collaborationCore.js # Peer lifecycle
│   ├── dataConnection.js    # Connection management
│   ├── messageHandler.js    # Event processing
│   ├── messageSender.js     # Event broadcasting
│   └── coordinateUtils.js   # Normalization helpers
└── README.md                # This file
```

## Technical Details

### Overlay Window Configuration
```javascript
const overlayWindow = new BrowserWindow({
  transparent: true,        // Enable transparency
  frame: false,             // No window frame
  alwaysOnTop: true,        // Stay above other windows
  skipTaskbar: true,        // Don't show in taskbar
  resizable: false,         // Prevent manual resize
  focusable: true,          // Allow keyboard input
  hasShadow: false          // No drop shadow
});
```

### Canvas Context Settings
```javascript
ctx.lineCap = 'round';      // Smooth line ends
ctx.lineJoin = 'round';     // Smooth line joins
ctx.globalAlpha = 0.8;      // Semi-transparent strokes
```

## Future Enhancements

Potential improvements:
- Undo/redo stroke history
- More drawing tools (shapes, text)
- Stroke smoothing/interpolation
- Session recording/replay
- File sharing via data channels
- Audio annotations
- Multi-display overlay support

## License

MIT

## Credits

Built with:
- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [PeerJS](https://peerjs.com/) - WebRTC peer connections
- WebRTC - Real-time communication
- HTML5 Canvas - 2D rendering

---

**Note**: This is a proof-of-concept implementation. For production use, consider adding:
- Authentication/authorization
- Encrypted data channels
- Better error handling
- Persistent sessions
- User management

