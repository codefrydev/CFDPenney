// Screen Capture and WebRTC Connection (Main Window)
import { state, getPeerColor } from './state.js';
import { startCollaboration, stopCollaboration, initPeerJS } from './collaboration/collaborationCore.js';
import { sendToAllPeers } from './collaboration/messageSender.js';
import { setCanvasDimensions } from './collaboration/messageHandler.js';

// Initialize PeerJS when available
window.addEventListener('load', () => {
    initPeerJS();
});

// UI Elements
const videoElem = document.getElementById('screen-video');
const placeholder = document.getElementById('placeholder');
const btnSelectSource = document.getElementById('btn-select-source');
const btnStartShare = document.getElementById('btn-start-share');
const btnStopShare = document.getElementById('btn-stop-share');
const btnHostSession = document.getElementById('btn-host-session');
const btnStopSession = document.getElementById('btn-stop-session');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const sourcePicker = document.getElementById('source-picker');
const sourceList = document.getElementById('source-list');
const btnConfirmSource = document.getElementById('btn-confirm-source');
const btnCancelSource = document.getElementById('btn-cancel-source');

let selectedSource = null;
let sources = [];

// Update connection status
window.updateConnectionStatus = (connected, shareCode = null) => {
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = state.isHosting 
            ? `Hosting: ${shareCode}` 
            : `Connected: ${shareCode}`;
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = state.isHosting 
            ? `Waiting: ${shareCode}` 
            : 'Not connected';
    }
};

// Alert function
window.showAlert = (message) => {
    alert(message);
};

// Select source button
btnSelectSource.addEventListener('click', async () => {
    try {
        sources = await window.electronAPI.getSources();
        
        sourceList.innerHTML = '';
        sources.forEach((source, index) => {
            const item = document.createElement('div');
            item.className = 'source-item';
            item.dataset.index = index;
            
            const img = document.createElement('img');
            img.src = source.thumbnail;
            
            const span = document.createElement('span');
            span.textContent = source.name;
            
            item.appendChild(img);
            item.appendChild(span);
            
            item.addEventListener('click', () => {
                document.querySelectorAll('.source-item').forEach(el => 
                    el.classList.remove('selected')
                );
                item.classList.add('selected');
                selectedSource = source;
            });
            
            sourceList.appendChild(item);
        });
        
        sourcePicker.classList.add('active');
    } catch (err) {
        console.error('Error getting sources:', err);
        alert('Failed to get available screens/windows');
    }
});

// Confirm source selection
btnConfirmSource.addEventListener('click', () => {
    if (!selectedSource) {
        alert('Please select a screen or window');
        return;
    }
    
    state.selectedSourceId = selectedSource.id;
    btnStartShare.disabled = false;
    sourcePicker.classList.remove('active');
});

// Cancel source selection
btnCancelSource.addEventListener('click', () => {
    sourcePicker.classList.remove('active');
    selectedSource = null;
});

// Start screen sharing
btnStartShare.addEventListener('click', async () => {
    if (!state.selectedSourceId) {
        alert('Please select a screen or window first');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: state.selectedSourceId
                }
            }
        });
        
        state.stream = stream;
        videoElem.srcObject = stream;
        videoElem.classList.add('active');
        placeholder.classList.add('hidden');
        
        btnStartShare.style.display = 'none';
        btnStopShare.style.display = 'block';
        btnSelectSource.disabled = true;
        
        // Get display info for overlay
        const displayInfo = await window.electronAPI.getDisplayInfo();
        setCanvasDimensions(
            videoElem.videoWidth || 1920,
            videoElem.videoHeight || 1080
        );
        
        // If already hosting, share with connected peers
        if (state.isHosting && state.dataConnections.size > 0) {
            state.dataConnections.forEach((conn, peerId) => {
                if (conn && conn.open && state.peer) {
                    const call = state.peer.call(peerId, stream);
                    if (call) {
                        state.calls.set(peerId, call);
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error starting screen share:', err);
        alert('Failed to start screen sharing: ' + err.message);
    }
});

// Stop screen sharing
btnStopShare.addEventListener('click', () => {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    
    videoElem.srcObject = null;
    videoElem.classList.remove('active');
    placeholder.classList.remove('hidden');
    
    btnStartShare.style.display = 'block';
    btnStopShare.style.display = 'none';
    btnSelectSource.disabled = false;
    btnStartShare.disabled = state.selectedSourceId ? false : true;
});

// Host session
btnHostSession.addEventListener('click', async () => {
    try {
        await startCollaboration();
        
        btnHostSession.style.display = 'none';
        btnStopSession.style.display = 'block';
    } catch (err) {
        console.error('Error hosting session:', err);
    }
});

// Stop session
btnStopSession.addEventListener('click', () => {
    stopCollaboration();
    
    btnHostSession.style.display = 'block';
    btnStopSession.style.display = 'none';
});

// Listen for overlay events and broadcast to peers
if (window.electronAPI) {
    window.electronAPI.onOverlayEvent((data) => {
        // Broadcast overlay events to all connected peers
        if (state.isCollaborating) {
            sendToAllPeers(data);
        }
    });
}

// Create a custom event handler for peer messages that forwards to overlay
// Send NORMALIZED coordinates to overlay - let overlay denormalize using its own canvas dimensions
window.handlePeerOverlayEvent = (message) => {
    if (!message || !message.type) return;
    
    // Forward overlay-related events to the overlay window via IPC
    // IMPORTANT: Send normalized (0-1) coordinates, overlay will denormalize
    switch (message.type) {
        case 'POINTER_MOVE':
            if (window.electronAPI) {
                // Get normalized coords (either nx/ny or x/y)
                const nx = message.nx !== undefined ? message.nx : message.x;
                const ny = message.ny !== undefined ? message.ny : message.y;
                
                if (nx !== undefined && ny !== undefined) {
                    window.electronAPI.sendPointerMove({
                        peerId: message.peerId,
                        nx: nx,
                        ny: ny,
                        color: getPeerColor(message.peerId)
                    });
                }
            }
            break;
            
        // Support both ANNOTATION_* (from web project) and STROKE_* (from Electron) formats
        case 'ANNOTATION_START':
        case 'STROKE_START':
            if (window.electronAPI) {
                // Get normalized coords (either nx/ny or x/y)
                const nx = message.nx !== undefined ? message.nx : message.x;
                const ny = message.ny !== undefined ? message.ny : message.y;
                
                if (nx !== undefined && ny !== undefined) {
                    window.electronAPI.sendStrokeStart({
                        id: message.id,
                        peerId: message.peerId,
                        tool: message.tool,
                        color: message.color,
                        width: message.width,
                        nx: nx,
                        ny: ny
                    });
                }
            }
            break;
            
        case 'ANNOTATION_MOVE':
        case 'STROKE_MOVE':
            if (window.electronAPI) {
                // Get normalized coords (either nx/ny or x/y)
                const nx = message.nx !== undefined ? message.nx : message.x;
                const ny = message.ny !== undefined ? message.ny : message.y;
                
                if (nx !== undefined && ny !== undefined) {
                    window.electronAPI.sendStrokeMove({
                        id: message.id,
                        peerId: message.peerId,
                        nx: nx,
                        ny: ny
                    });
                }
            }
            break;
            
        case 'ANNOTATION_END':
        case 'STROKE_END':
            if (window.electronAPI) {
                window.electronAPI.sendStrokeEnd({
                    id: message.id,
                    peerId: message.peerId
                });
            }
            break;
            
        case 'ANNOTATION_CLEAR':
        case 'CLEAR_OVERLAY':
            if (window.electronAPI) {
                window.electronAPI.sendClearOverlay();
            }
            break;
    }
};

// Update video dimensions when metadata loads
videoElem.addEventListener('loadedmetadata', () => {
    setCanvasDimensions(videoElem.videoWidth, videoElem.videoHeight);
});

