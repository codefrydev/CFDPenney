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
    dataConnection: null,
    call: null,
    isCollaborating: false,
    isHosting: false,
    shareCode: null,
    peerElements: [] // Elements from peer
};

