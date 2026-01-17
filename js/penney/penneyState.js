// State Management for Penney (Infinite Canvas)
export const state = {
    mode: 'whiteboard', // Always whiteboard for infinite canvas
    tool: 'pencil',
    color: '#FF3B30',
    fillColor: '#FF3B30', // Fill color for shapes
    filled: false, // Whether shapes should be filled
    strokeWidth: 4,
    isDrawing: false,
    elements: [], // History array
    historyStep: -1, // Current position in history
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
    // Viewport state (for infinite canvas)
    viewportX: 0, // Viewport offset X
    viewportY: 0, // Viewport offset Y
    zoom: 1, // Zoom level (1 = 100%)
    minZoom: 0.1, // Minimum zoom level
    maxZoom: 10, // Maximum zoom level
    // Pan state
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartViewportX: 0,
    panStartViewportY: 0,
    // Peer collaboration state (basic - drawing sync only)
    peer: null,
    dataConnections: new Map(), // Map<peerId, DataConnection>
    calls: new Map(), // Map<peerId, MediaConnection> - for screen share (not used in penney but needed for compatibility)
    cameraCalls: new Map(), // Map<peerId, MediaConnection> - for camera streams (not used in penney but needed for compatibility)
    connectedPeers: new Map(), // Map<peerId, {id, connectedAt}>
    isCollaborating: false,
    isHosting: false,
    shareCode: null,
    peerElements: [], // Elements from peers (each element has peerId)
    myPeerId: null, // Our own peer ID for identification
    // Compatibility properties (not used in penney but needed for collaboration modules)
    stream: null, // Screen share stream (not used)
    isVideoPaused: false, // Video pause state (not used)
    backgroundImageSrc: null, // Background image (not used)
    cameraStream: null, // Camera stream (not used)
    isCameraActive: false, // Camera active state (not used)
    isAudioMuted: true, // Audio muted (not used)
    cameraMode: false, // Camera mode (not used)
    cameraWindowState: 'normal', // Camera window state (not used)
    cameraWindowSize: { width: 240, height: 180 }, // Camera window size (not used)
    cameraWindowPosition: { x: null, y: null }, // Camera window position (not used)
    isCameraHidden: false, // Camera hidden state (not used)
    selectedCameraId: null, // Selected camera (not used)
    selectedMicrophoneId: null, // Selected microphone (not used)
    selectedSpeakerId: null, // Selected speaker (not used)
    chatMessages: [], // Chat messages (not used)
    unreadChatCount: 0, // Unread chat count (not used)
    isTyping: false, // Typing indicator (not used)
    participantsPanelWidth: 320, // Participants panel width (not used)
    participantsPanelVisible: false, // Participants panel visible (not used)
    spaceKeyPressed: false, // Space key pressed state for pan
    // Trail tool state
    trailFadeDuration: 3000, // Duration in ms before trails completely fade
    trailType: 'fade', // Trail effect type: 'fade', 'sequential', 'laser'
    animationFrameId: null, // RAF ID for trail animation loop
    trailsActive: false // Whether trail animation loop is running
};

