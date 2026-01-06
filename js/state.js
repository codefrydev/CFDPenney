// State Management
export const state = {
    mode: 'whiteboard', // 'whiteboard', 'screen', 'image'
    tool: 'pencil',
    color: '#FF3B30',
    fillColor: '#FF3B30', // Fill color for shapes
    filled: false, // Whether shapes should be filled
    strokeWidth: 4,
    isDrawing: false,
    elements: [], // History array
    historyStep: -1, // Current position in history
    stream: null,
    isVideoPaused: false,
    backgroundImageSrc: null,
    // Camera state
    cameraStream: null,
    isCameraActive: false,
    isAudioMuted: true, // Audio muted by default
    cameraMode: false, // Distinguish camera from screen sharing
    cameraWindowState: 'normal', // 'normal', 'minimized', 'maximized'
    cameraWindowSize: { width: 240, height: 180 }, // Default size
    cameraWindowPosition: { x: null, y: null }, // null means use CSS default (bottom-right)
    isCameraHidden: false, // Whether video is hidden (camera still active)
    textInput: null, // {x, y, text}
    // Selection state
    selectedElementId: null,
    selectedElementIndex: -1,
    selectedElementIds: [], // Multi-selection support
    isResizing: false,
    isRotating: false,
    resizeHandle: null,
    isMultiSelecting: false, // For drag selection box
    isDraggingSelection: false, // For tracking drag-to-select vs drag-to-move
    selectionBoxStart: null, // For drag selection
    selectionBoxEnd: null,
    selectionMode: 'intersect', // 'contain' or 'intersect' - how selection box selects elements
    dragStartPoint: null, // Starting point for drag operations
    // Peer collaboration state
    peer: null,
    dataConnections: new Map(), // Map<peerId, DataConnection>
    calls: new Map(), // Map<peerId, MediaConnection> - for screen share
    cameraCalls: new Map(), // Map<peerId, MediaConnection> - for camera streams
    connectedPeers: new Map(), // Map<peerId, {id, connectedAt}>
    isCollaborating: false,
    isHosting: false,
    shareCode: null,
    peerElements: [], // Elements from peers (each element has peerId)
    myPeerId: null // Our own peer ID for identification
};

