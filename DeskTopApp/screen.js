// Screen Capture and WebRTC Connection (Main Window)
import { state, getPeerColor } from './state.js';
import { startCollaboration, stopCollaboration, initPeerJS } from './collaboration/collaborationCore.js';
import { sendToAllPeers } from './collaboration/messageSender.js';
import { setCanvasDimensions } from './collaboration/messageHandler.js';
import { shareCameraWithPeers } from './collaboration/videoCall.js';
import { initDeviceSelection, populateDeviceSelects, getSelectedDeviceIds, saveDevicePreferences } from './deviceSelection.js';
import './collaboration/chat.js';
import './collaboration/participantsPanel.js';

// Initialize PeerJS when available
window.addEventListener('load', () => {
    initPeerJS();
    initDeviceSelection();
    setupDeviceModal();
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
const btnCamera = document.getElementById('btn-camera');
const btnParticipants = document.getElementById('btn-participants');
const btnCloseParticipants = document.getElementById('btn-close-participants');
const btnCopyShareCode = document.getElementById('btn-copy-share-code');
const copyFeedback = document.getElementById('copy-feedback');

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
    
    // Show/hide copy button based on whether share code exists
    if (shareCode && btnCopyShareCode) {
        btnCopyShareCode.style.display = 'inline-flex';
        btnCopyShareCode.dataset.shareCode = shareCode;
    } else if (btnCopyShareCode) {
        btnCopyShareCode.style.display = 'none';
    }
};

// Alert function
window.showAlert = (message) => {
    alert(message);
};

// Copy share code to clipboard
if (btnCopyShareCode) {
    btnCopyShareCode.addEventListener('click', async () => {
        const shareCode = btnCopyShareCode.dataset.shareCode || state.shareCode;
        if (!shareCode) return;
        
        try {
            // Use Clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(shareCode);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = shareCode;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            
            // Show feedback
            if (copyFeedback) {
                copyFeedback.style.display = 'inline-block';
                setTimeout(() => {
                    copyFeedback.style.display = 'none';
                }, 2000);
            }
            
            // Update button icon temporarily
            const icon = btnCopyShareCode.querySelector('i');
            if (icon) {
                const originalClass = icon.className;
                icon.className = 'fas fa-check';
                setTimeout(() => {
                    icon.className = originalClass;
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy share code:', err);
            // Fallback: show alert with code
            alert(`Share code: ${shareCode}\n\n(Please copy manually)`);
        }
    });
}

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
        // Mute local stream to prevent feedback/echo
        videoElem.muted = true;
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
    const videoWidth = videoElem.videoWidth;
    const videoHeight = videoElem.videoHeight;
    setCanvasDimensions(videoWidth, videoHeight);
    
    // Send video dimensions to overlay for accurate coordinate mapping
    // The overlay uses these dimensions to denormalize coordinates from viewers
    // This ensures 1:1 pixel alignment with the actual shared screen
    if (window.electronAPI) {
        window.electronAPI.sendVideoDimensions(videoWidth, videoHeight);
    }
});

// Camera button handler
if (btnCamera) {
    btnCamera.addEventListener('click', async () => {
        if (!state.isCameraActive) {
            // Start camera with selected devices
            try {
                const videoConstraints = state.selectedCameraId 
                    ? { deviceId: { exact: state.selectedCameraId } }
                    : { facingMode: 'user' };
                
                const audioConstraints = state.selectedMicrophoneId
                    ? { deviceId: { exact: state.selectedMicrophoneId } }
                    : true;
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: audioConstraints
                });
                
                // Mute audio by default
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks.forEach(track => {
                        track.enabled = false; // Muted by default
                    });
                }
                state.isAudioMuted = true;
                
                state.cameraStream = stream;
                state.isCameraActive = true;
                
                // Update button icon
                const iconOff = document.getElementById('camera-btn-icon-off');
                const iconOn = document.getElementById('camera-btn-icon-on');
                if (iconOff) iconOff.style.display = 'none';
                if (iconOn) iconOn.style.display = 'inline';
                
                // Share camera with peers if collaborating
                if (state.isCollaborating) {
                    shareCameraWithPeers(stream);
                }
                
                // Update participants panel
                if (window.updateParticipantsPanel) {
                    window.updateParticipantsPanel();
                }
                
                // Update local mic indicator
                if (window.updateLocalMicIndicator) {
                    window.updateLocalMicIndicator();
                }
            } catch (err) {
                console.error('Error starting camera:', err);
                alert('Failed to start camera: ' + err.message);
            }
        } else {
            // Stop camera
            if (state.cameraStream) {
                state.cameraStream.getTracks().forEach(track => track.stop());
                state.cameraStream = null;
            }
            state.isCameraActive = false;
            state.isAudioMuted = true;
            
            // Update button icon
            const iconOff = document.getElementById('camera-btn-icon-off');
            const iconOn = document.getElementById('camera-btn-icon-on');
            if (iconOff) iconOff.style.display = 'inline';
            if (iconOn) iconOn.style.display = 'none';
            
            // Stop sharing camera with peers
            if (state.isCollaborating) {
                shareCameraWithPeers(null);
            }
            
            // Update participants panel
            if (window.updateParticipantsPanel) {
                window.updateParticipantsPanel();
            }
        }
    });
    
    // Right-click or long-press for device settings
    btnCamera.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openDeviceSettings();
    });
}

// Participants panel button handler
if (btnParticipants) {
    btnParticipants.addEventListener('click', () => {
        const panel = document.getElementById('participants-panel');
        if (panel) {
            const isVisible = !panel.classList.contains('hidden');
            if (isVisible) {
                state.participantsPanelVisible = false;
                panel.classList.add('hidden');
            } else {
                state.participantsPanelVisible = true;
                panel.classList.remove('hidden');
            }
            
            // Update participants panel to refresh state
            if (window.updateParticipantsPanel) {
                window.updateParticipantsPanel();
            }
        }
    });
}

// Close participants panel button handler
if (btnCloseParticipants) {
    btnCloseParticipants.addEventListener('click', () => {
        const panel = document.getElementById('participants-panel');
        if (panel) {
            state.participantsPanelVisible = false;
            panel.classList.add('hidden');
            
            // Update participants panel to refresh state
            if (window.updateParticipantsPanel) {
                window.updateParticipantsPanel();
            }
        }
    });
}

// Device selection modal handlers
function setupDeviceModal() {
    const modalOverlay = document.getElementById('device-selection-modal-overlay');
    const btnCloseDeviceModal = document.getElementById('btn-close-device-modal');
    const btnCancelDevices = document.getElementById('btn-cancel-devices');
    const btnApplyDevices = document.getElementById('btn-apply-devices');
    
    // Open device settings
    window.openDeviceSettings = () => {
        if (modalOverlay && window.populateDeviceSelects) {
            modalOverlay.classList.remove('hidden');
            window.populateDeviceSelects();
        }
    };
    
    // Close device modal
    const closeDeviceModal = () => {
        if (modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    };
    
    // Apply device selection
    const applyDeviceSelection = async () => {
        const deviceIds = getSelectedDeviceIds();
        
        // Update state
        state.selectedCameraId = deviceIds.cameraId;
        state.selectedMicrophoneId = deviceIds.microphoneId;
        state.selectedSpeakerId = deviceIds.speakerId;
        
        // Save preferences
        saveDevicePreferences();
        
        // If camera is active, restart with new devices
        if (state.isCameraActive && state.cameraStream) {
            try {
                // Stop current stream
                state.cameraStream.getTracks().forEach(track => track.stop());
                state.cameraStream = null;
                state.isCameraActive = false;
                
                // Update button icon
                const iconOff = document.getElementById('camera-btn-icon-off');
                const iconOn = document.getElementById('camera-btn-icon-on');
                if (iconOff) iconOff.style.display = 'inline';
                if (iconOn) iconOn.style.display = 'none';
                
                // Start camera with new devices
                const videoConstraints = deviceIds.cameraId 
                    ? { deviceId: { exact: deviceIds.cameraId } }
                    : { facingMode: 'user' };
                
                const audioConstraints = deviceIds.microphoneId
                    ? { deviceId: { exact: deviceIds.microphoneId } }
                    : true;
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: audioConstraints
                });
                
                // Mute audio by default
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks.forEach(track => {
                        track.enabled = !state.isAudioMuted;
                    });
                }
                
                state.cameraStream = stream;
                state.isCameraActive = true;
                
                // Update button icon
                if (iconOff) iconOff.style.display = 'none';
                if (iconOn) iconOn.style.display = 'inline';
                
                // Share camera with peers if collaborating
                if (state.isCollaborating) {
                    shareCameraWithPeers(stream);
                }
                
                // Update participants panel
                if (window.updateParticipantsPanel) {
                    window.updateParticipantsPanel();
                }
            } catch (err) {
                console.error('Error restarting camera with new devices:', err);
                alert('Failed to apply device selection. Please try again.');
            }
        }
        
        closeDeviceModal();
    };
    
    if (btnCloseDeviceModal) {
        btnCloseDeviceModal.addEventListener('click', closeDeviceModal);
    }
    
    if (btnCancelDevices) {
        btnCancelDevices.addEventListener('click', closeDeviceModal);
    }
    
    if (btnApplyDevices) {
        btnApplyDevices.addEventListener('click', applyDeviceSelection);
    }
    
    // Close modal when clicking overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeDeviceModal();
            }
        });
    }
}

