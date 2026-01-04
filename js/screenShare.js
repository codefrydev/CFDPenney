// Screen Sharing
import { state } from './state.js';

let videoElem = null;
let videoPlaceholder = null;
let videoControls = null;

export function initScreenShare(videoEl, placeholderEl, controlsEl) {
    videoElem = videoEl;
    videoPlaceholder = placeholderEl;
    videoControls = controlsEl;
}

export function setMode(newMode) {
    // Stop screen share if leaving screen mode
    if (state.mode === 'screen' && newMode !== 'screen') {
        stopScreenShareLogic();
    }
    state.mode = newMode;
}

export async function startScreenShare() {
    try {
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });
        state.stream = mediaStream;
        if (videoElem) {
            videoElem.srcObject = mediaStream;
        }
        if (videoPlaceholder) {
            videoPlaceholder.classList.add('hidden');
        }
        if (videoControls) {
            videoControls.classList.remove('hidden');
        }
        
        setMode('screen');

        // If collaborating, share the screen stream with connected peers
        // This will be handled by collaboration module
        if (state.isCollaborating && window.shareScreenWithPeers) {
            window.shareScreenWithPeers(mediaStream);
        }

        // Detect system stop
        mediaStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };
    } catch (err) {
        console.error("Error sharing screen:", err);
        setMode('whiteboard');
    }
}

export function stopScreenShare() {
    stopScreenShareLogic();
    setMode('whiteboard');
}

export function stopScreenShareLogic() {
    // If collaborating, replace stream with dummy stream to notify peers
    // This will be handled by collaboration module
    if (state.isCollaborating && state.call && state.call.peerConnection) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const dummyStream = canvas.captureStream ? canvas.captureStream(1) : null;
        
        if (dummyStream) {
            const videoTrack = dummyStream.getVideoTracks()[0];
            if (videoTrack) {
                const senders = state.call.peerConnection.getSenders();
                const videoSender = senders.find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    videoSender.replaceTrack(videoTrack).catch(err => {
                        console.error('Error replacing track with dummy:', err);
                    });
                }
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

