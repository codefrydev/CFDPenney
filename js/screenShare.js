// Screen Sharing
import { state } from './state.js';

let videoElem = null;
let videoPlaceholder = null;
let videoControls = null;
let isStarting = false; // Guard to prevent multiple simultaneous attempts

export function initScreenShare(videoEl, placeholderEl, controlsEl) {
    videoElem = videoEl;
    videoPlaceholder = placeholderEl;
    videoControls = controlsEl;
}

// Check if screen sharing API is available
function isScreenShareSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
}

// Check if we're in a secure context (required for screen sharing)
function isSecureContext() {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// Show user-friendly error message
function showScreenShareError(message) {
    alert(`Screen Sharing Error: ${message}\n\nPlease ensure:\n- You're using a modern browser (Chrome, Firefox, Edge, Safari)\n- The page is served over HTTPS or localhost\n- You grant screen sharing permissions when prompted`);
}

export function setMode(newMode) {
    // Stop screen share if leaving screen mode
    if (state.mode === 'screen' && newMode !== 'screen') {
        stopScreenShareLogic();
    }
    state.mode = newMode;
}

export async function startScreenShare() {
    console.log('startScreenShare called');
    
    // Prevent multiple simultaneous attempts
    if (isStarting) {
        console.warn('Screen share start already in progress');
        return;
    }

    // Check if screen sharing is already active
    if (state.mode === 'screen' && state.stream) {
        console.warn('Screen sharing is already active');
        return;
    }

    // Validate browser support
    if (!isScreenShareSupported()) {
        console.error('Screen sharing not supported');
        showScreenShareError('Screen sharing is not supported in this browser. Please use Chrome, Firefox, Edge, or Safari.');
        setMode('whiteboard');
        return;
    }

    // Validate secure context
    if (!isSecureContext()) {
        console.error('Not in secure context');
        showScreenShareError('Screen sharing requires a secure context (HTTPS or localhost).');
        setMode('whiteboard');
        return;
    }

    isStarting = true;
    console.log('Starting screen share...');

    try {
        // Clean up any existing stream before starting new one
        if (state.stream) {
            stopScreenShareLogic();
        }

        // Set mode to screen first to ensure state is correct
        setMode('screen');
        console.log('Mode set to screen');

        console.log('Requesting display media...');
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });

        console.log('Display media obtained:', mediaStream);

        // Check if stream has video tracks
        if (!mediaStream || !mediaStream.getVideoTracks().length) {
            throw new Error('No video track in screen share stream');
        }

        state.stream = mediaStream;
        console.log('Stream stored in state');
        
        if (videoElem) {
            console.log('Setting video element srcObject');
            videoElem.srcObject = mediaStream;
            // Ensure video plays
            videoElem.play().catch(err => {
                console.warn('Video play error:', err);
            });
        } else {
            console.error('Video element not found!');
        }
        
        if (videoPlaceholder) {
            videoPlaceholder.classList.add('hidden');
            console.log('Placeholder hidden');
        } else {
            console.warn('Video placeholder not found');
        }
        
        if (videoControls) {
            videoControls.classList.remove('hidden');
            console.log('Controls shown');
        } else {
            console.warn('Video controls not found');
        }
        
        console.log('Screen share started successfully');

        // If collaborating, share the screen stream with connected peers
        // Use setTimeout to ensure mode is set and state is updated
        setTimeout(() => {
            if (state.isCollaborating && window.shareScreenWithPeers) {
                window.shareScreenWithPeers(mediaStream);
            }
        }, 100);

        // Detect system stop
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                stopScreenShare();
            };
        }
    } catch (err) {
        console.error("Error sharing screen:", err);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to start screen sharing.';
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Screen sharing permission was denied. Please allow screen sharing in your browser settings and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No screen or window available to share.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Unable to access screen. Another application may be using it.';
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
            errorMessage = 'Screen sharing constraints could not be satisfied.';
        } else if (err.name === 'AbortError') {
            errorMessage = 'Screen sharing was cancelled.';
        } else if (err.message) {
            errorMessage = `Screen sharing error: ${err.message}`;
        }
        
        showScreenShareError(errorMessage);
        setMode('whiteboard');
    } finally {
        isStarting = false;
    }
}

export function stopScreenShare() {
    stopScreenShareLogic();
    setMode('whiteboard');
}

export function stopScreenShareLogic() {
    // If collaborating, replace stream with dummy stream to notify peers
    // This will be handled by collaboration module
    if (state.isCollaborating && state.calls && state.calls.size > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const dummyStream = canvas.captureStream ? canvas.captureStream(1) : null;
        
        if (dummyStream) {
            const videoTrack = dummyStream.getVideoTracks()[0];
            if (videoTrack) {
                // Replace tracks in all active calls
                state.calls.forEach((call, peerId) => {
                    if (call && call.peerConnection) {
                        const senders = call.peerConnection.getSenders();
                        const videoSender = senders.find(s => 
                            s.track && s.track.kind === 'video'
                        );
                        if (videoSender) {
                            videoSender.replaceTrack(videoTrack).catch(err => {
                                console.error(`Error replacing track with dummy for peer ${peerId}:`, err);
                            });
                        }
                    }
                });
            }
        }
    }

    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    if (videoElem) {
        videoElem.srcObject = null;
    }
    if (videoPlaceholder) {
        videoPlaceholder.classList.remove('hidden');
    }
    if (videoControls) {
        videoControls.classList.add('hidden');
    }
    const frozenBadge = document.getElementById('video-frozen-badge');
    if (frozenBadge) {
        frozenBadge.classList.add('hidden');
    }
    state.isVideoPaused = false;
}

export function toggleVideoPause() {
    if (!videoElem || !videoElem.srcObject) return;
    
    state.isVideoPaused = !state.isVideoPaused;
    if (state.isVideoPaused) {
        videoElem.pause();
        const iconPause = document.getElementById('icon-pause');
        const iconPlay = document.getElementById('icon-play');
        const frozenBadge = document.getElementById('video-frozen-badge');
        if (iconPause) iconPause.classList.add('hidden');
        if (iconPlay) iconPlay.classList.remove('hidden');
        if (frozenBadge) frozenBadge.classList.remove('hidden');
        videoElem.style.opacity = '0.6';
    } else {
        videoElem.play();
        const iconPause = document.getElementById('icon-pause');
        const iconPlay = document.getElementById('icon-play');
        const frozenBadge = document.getElementById('video-frozen-badge');
        if (iconPause) iconPause.classList.remove('hidden');
        if (iconPlay) iconPlay.classList.add('hidden');
        if (frozenBadge) frozenBadge.classList.add('hidden');
        videoElem.style.opacity = '1';
    }
}

