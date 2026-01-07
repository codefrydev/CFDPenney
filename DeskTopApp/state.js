// Shared State Management for Electron App
export const state = {
    mode: 'screen', // Always screen mode for Electron
    tool: 'pointer', // 'pointer', 'pencil', 'eraser'
    color: '#FF3B30',
    strokeWidth: 4,
    isDrawing: false,
    
    // Overlay state
    overlayMode: 'view', // 'view' (click-through) or 'draw' (interactive)
    pointers: new Map(), // Map<peerId, {x, y, color, timestamp}>
    strokes: new Map(), // Map<strokeId, {peerId, tool, color, width, points[]}>
    activeStrokes: new Map(), // Map<peerId, strokeId> - tracks active drawing
    
    // WebRTC/Peer state
    peer: null,
    dataConnections: new Map(), // Map<peerId, DataConnection>
    calls: new Map(), // Map<peerId, MediaConnection>
    connectedPeers: new Map(), // Map<peerId, {id, connectedAt, color}>
    isCollaborating: false,
    isHosting: false,
    shareCode: null,
    myPeerId: null,
    
    // Screen share state
    stream: null,
    selectedSourceId: null,
    
    // Chat state
    chatMessages: [], // Array of chat messages
    unreadChatCount: 0, // Number of unread messages
    
    // Camera/Video call state
    cameraStream: null, // Current camera stream
    isCameraActive: false, // Boolean flag for camera status
    cameraCalls: new Map(), // Map<peerId, MediaConnection> - separate from screen share calls
    
    // Participants panel state
    participantsPanelVisible: undefined, // Whether participants panel is visible
    participantsPanelWidth: 320 // Default width of participants panel
};

// Generate color from peer ID
export function getPeerColor(peerId) {
    if (!peerId) return '#FF3B30';
    
    // Hash the peerId to get consistent color
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to HSL for better color distribution
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
}

