// Web Collaboration Wrapper
// Bridges the shared collaboration modules with web-specific functionality

import { state } from '../state.js';
import { webAdapter } from '../../shared/adapters/webAdapter.js';
import { 
    startCollaboration as sharedStartCollaboration,
    joinCollaborationWithCode as sharedJoinCollaboration,
    stopCollaboration as sharedStopCollaboration
} from '../../shared/collaboration/collaborationCore.js';
import { setupCallHandlers as sharedSetupCallHandlers, shareScreenWithPeers as sharedShareScreenWithPeers, shareCameraWithPeers as sharedShareCameraWithPeers, remoteCameraStreams } from '../../shared/collaboration/videoCall.js';
import { handlePeerMessage } from './messageHandler.js';
import { showAlert } from '../popupModal.js';
import { updateConnectionStatus } from './connectionStatus.js';
import { redrawCanvas } from '../canvas.js';
import { normalizeCoordinates, denormalizeCoordinates } from '../canvas.js';
import { removeCodeFromURL } from './urlUtils.js';
import { registerSession, unregisterSession, markSessionAvailable, markSessionConnected } from '../discovery.js';

// Initialize the web adapter with platform-specific functions
function initializeWebAdapter() {
    // Check if already initialized
    if (webAdapter._showAlertFn) {
        return;
    }
    
    webAdapter.initialize({
        showAlert: showAlert,
        updateConnectionStatus: updateConnectionStatus,
        redrawCanvas: redrawCanvas,
        normalizeCoordinates: normalizeCoordinates,
        denormalizeCoordinates: denormalizeCoordinates,
        getCanvasDimensions: () => {
            const canvas = document.getElementById('canvas');
            if (canvas) {
                return { width: canvas.width, height: canvas.height };
            }
            return { width: 0, height: 0 };
        },
        discovery: {
            registerSession,
            unregisterSession,
            markSessionAvailable,
            markSessionConnected
        },
        urlUtils: {
            removeCodeFromURL
        }
    });
}

// Web-specific screen stream handler
function handleRemoteScreenStream(remoteStream, peerId, videoTrack) {
    // Display the remote stream in the video element
    const videoElem = document.getElementById('screen-video');
    const videoPlaceholder = document.getElementById('screen-placeholder');
    const videoControls = document.getElementById('screen-controls');
    const bgScreen = document.getElementById('bg-screen');
    
    if (videoElem && remoteStream) {
        // Set the remote stream to the video element
        videoElem.srcObject = remoteStream;
        videoElem.muted = false;
        
        videoElem.play().catch(err => {
            if (err.name !== 'AbortError') {
                console.error('Error playing video:', err);
            }
        });
        
        // Hide placeholder and show video
        if (videoPlaceholder) {
            videoPlaceholder.classList.add('hidden');
        }
        
        // Show controls
        if (videoControls) {
            videoControls.classList.remove('hidden');
            const stopBtn = document.getElementById('btn-stop-share');
            if (stopBtn && !state.isHosting) {
                stopBtn.style.display = 'none';
            } else if (stopBtn && state.isHosting) {
                stopBtn.style.display = '';
            }
        }
        
        // Switch to screen mode if not already
        if (state.mode !== 'screen') {
            import('../screenShare.js').then(module => {
                module.setMode('screen');
                if (window.updateUI) {
                    window.updateUI();
                }
            });
        }
        
        // Show the screen background layer
        if (bgScreen) {
            bgScreen.classList.remove('hidden');
        }
        
        // Update UI
        if (window.updateUI) {
            window.updateUI();
        }
        
        // Track when the remote stream ends
        videoTrack.onended = () => {
            if (videoElem) {
                videoElem.srcObject = null;
            }
            if (videoPlaceholder) {
                videoPlaceholder.classList.remove('hidden');
            }
            if (videoControls) {
                videoControls.classList.add('hidden');
            }
            if (!state.stream || state.mode === 'screen') {
                import('../screenShare.js').then(module => {
                    if (!state.stream) {
                        module.setMode('whiteboard');
                        if (window.updateUI) {
                            window.updateUI();
                        }
                    }
                });
            }
        };
    }
}

// Wrapper for setupCallHandlers with web-specific screen handler
function setupCallHandlers(call, peerId) {
    sharedSetupCallHandlers(call, peerId, state, handleRemoteScreenStream);
}

// Wrapper for recreateCallWithStream
function recreateCallWithStream(stream, peerId) {
    if (!state.isHosting || !peerId || !state.peer) return;
    
    const existingCall = state.calls.get(peerId);
    if (existingCall) {
        existingCall.close();
        state.calls.delete(peerId);
    }

    const call = state.peer.call(peerId, stream);
    if (call) {
        state.calls.set(peerId, call);
        setupCallHandlers(call, peerId);
    }
}

// Export wrapped functions
export async function startCollaboration() {
    initializeWebAdapter();
    return sharedStartCollaboration(state, webAdapter, handlePeerMessage, setupCallHandlers, window.Peer);
}

export async function joinCollaborationWithCode(code) {
    initializeWebAdapter();
    return sharedJoinCollaboration(code, state, webAdapter, handlePeerMessage, setupCallHandlers, stopCollaboration, window.Peer);
}

export function stopCollaboration() {
    initializeWebAdapter();
    return sharedStopCollaboration(state, webAdapter);
}

export function shareScreenWithPeers(stream) {
    return sharedShareScreenWithPeers(stream, state, recreateCallWithStream);
}

export function shareCameraWithPeers(stream) {
    return sharedShareCameraWithPeers(stream, state);
}

// Make functions available globally
window.shareScreenWithPeers = shareScreenWithPeers;
window.shareCameraWithPeers = shareCameraWithPeers;
window.remoteCameraStreams = remoteCameraStreams;
