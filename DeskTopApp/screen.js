// Screen Capture and WebRTC Connection (Main Window)
import { state, getPeerColor } from './state.js';
import { startCollaboration, joinCollaborationWithCode, stopCollaboration, initPeerJS } from './collaboration/collaborationCore.js';
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
const btnJoinSession = document.getElementById('btn-join-session');
const btnStopSession = document.getElementById('btn-stop-session');
const joinCodeInput = document.getElementById('join-code-input');
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
        
        console.log('Screen sharing started');
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
        btnJoinSession.style.display = 'none';
        joinCodeInput.style.display = 'none';
        btnStopSession.style.display = 'block';
    } catch (err) {
        console.error('Error hosting session:', err);
    }
});

// Join session
btnJoinSession.addEventListener('click', async () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) {
        alert('Please enter a share code');
        return;
    }
    
    try {
        await joinCollaborationWithCode(code);
        
        btnHostSession.style.display = 'none';
        btnJoinSession.style.display = 'none';
        joinCodeInput.style.display = 'none';
        btnStopSession.style.display = 'block';
    } catch (err) {
        console.error('Error joining session:', err);
    }
});

// Stop session
btnStopSession.addEventListener('click', () => {
    stopCollaboration();
    
    btnHostSession.style.display = 'block';
    btnJoinSession.style.display = 'block';
    joinCodeInput.style.display = 'block';
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
window.handlePeerOverlayEvent = (message) => {
    if (!message || !message.type) return;
    
    console.log('[Screen] Handling peer overlay event:', message.type, message);
    
    // Forward overlay-related events to the overlay window via IPC
    switch (message.type) {
        case 'POINTER_MOVE':
            if (window.electronAPI && message.nx !== undefined && message.ny !== undefined) {
                // Denormalize coordinates for this screen
                const x = message.nx * (videoElem.videoWidth || 1920);
                const y = message.ny * (videoElem.videoHeight || 1080);
                console.log('[Screen] Forwarding pointer move:', x, y);
                window.electronAPI.sendPointerMove({
                    peerId: message.peerId,
                    x: x,
                    y: y,
                    color: getPeerColor(message.peerId)
                });
            }
            break;
            
        // Support both ANNOTATION_* (from web project) and STROKE_* (from Electron) formats
        case 'ANNOTATION_START':
        case 'STROKE_START':
            if (window.electronAPI) {
                // Handle both normalized (nx/ny) and pixel (x/y) coordinates
                let x, y;
                if (message.nx !== undefined && message.ny !== undefined) {
                    x = message.nx * (videoElem.videoWidth || 1920);
                    y = message.ny * (videoElem.videoHeight || 1080);
                } else if (message.x !== undefined && message.y !== undefined) {
                    // Already normalized, denormalize
                    x = message.x * (videoElem.videoWidth || 1920);
                    y = message.y * (videoElem.videoHeight || 1080);
                }
                
                if (x !== undefined && y !== undefined) {
                    console.log('[Screen] Forwarding stroke start:', x, y);
                    window.electronAPI.sendStrokeStart({
                        id: message.id,
                        peerId: message.peerId,
                        tool: message.tool,
                        color: message.color,
                        width: message.width,
                        x: x,
                        y: y
                    });
                }
            }
            break;
            
        case 'ANNOTATION_MOVE':
        case 'STROKE_MOVE':
            if (window.electronAPI) {
                // Handle both normalized (nx/ny) and pixel (x/y) coordinates
                let x, y;
                if (message.nx !== undefined && message.ny !== undefined) {
                    x = message.nx * (videoElem.videoWidth || 1920);
                    y = message.ny * (videoElem.videoHeight || 1080);
                } else if (message.x !== undefined && message.y !== undefined) {
                    x = message.x * (videoElem.videoWidth || 1920);
                    y = message.y * (videoElem.videoHeight || 1080);
                }
                
                if (x !== undefined && y !== undefined) {
                    window.electronAPI.sendStrokeMove({
                        id: message.id,
                        peerId: message.peerId,
                        x: x,
                        y: y
                    });
                }
            }
            break;
            
        case 'ANNOTATION_END':
        case 'STROKE_END':
            if (window.electronAPI) {
                console.log('[Screen] Forwarding stroke end');
                window.electronAPI.sendStrokeEnd({
                    id: message.id,
                    peerId: message.peerId
                });
            }
            break;
            
        case 'ANNOTATION_CLEAR':
        case 'CLEAR_OVERLAY':
            if (window.electronAPI) {
                console.log('[Screen] Forwarding clear overlay');
                window.electronAPI.sendClearOverlay();
            }
            break;
    }
};

// Update video dimensions when metadata loads
videoElem.addEventListener('loadedmetadata', () => {
    setCanvasDimensions(videoElem.videoWidth, videoElem.videoHeight);
    console.log('Video dimensions:', videoElem.videoWidth, videoElem.videoHeight);
});

console.log('Screen.js loaded');

