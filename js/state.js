// State Management
export const state = {
    mode: 'whiteboard', // 'whiteboard', 'screen', 'image'
    tool: 'pencil',
    color: '#FF3B30',
    strokeWidth: 4,
    isDrawing: false,
    elements: [], // History array
    historyStep: -1, // Current position in history
    stream: null,
    isVideoPaused: false,
    backgroundImageSrc: null,
    textInput: null, // {x, y, text}
    // Peer collaboration state
    peer: null,
    dataConnections: new Map(), // Map<peerId, DataConnection>
    calls: new Map(), // Map<peerId, MediaConnection>
    connectedPeers: new Map(), // Map<peerId, {id, connectedAt}>
    isCollaborating: false,
    isHosting: false,
    shareCode: null,
    peerElements: [], // Elements from peers (each element has peerId)
    myPeerId: null // Our own peer ID for identification
};

