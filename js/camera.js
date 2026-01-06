// Camera Functionality
import { state } from './state.js';
import { showAlert } from './popupModal.js';

let cameraVideoElem = null;
let cameraContainer = null;
let cameraControls = null;
let isStarting = false; // Guard to prevent multiple simultaneous attempts

export function initCamera(videoEl, containerEl, controlsEl) {
    cameraVideoElem = videoEl;
    cameraContainer = containerEl;
    cameraControls = controlsEl;
    
    // Make camera container draggable
    if (cameraContainer) {
        makeDraggable(cameraContainer);
        initCameraResize();
    }
}

// Make element draggable
function makeDraggable(element) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let elementWidth = 0;
    let elementHeight = 0;
    let rafId = null;

    // Get initial position from CSS or default to bottom-right
    const rect = element.getBoundingClientRect();
    if (rect.left === 0 && rect.top === 0 && element.style.left === '' && element.style.right === '') {
        // Set default position (bottom-right)
        element.style.left = 'auto';
        element.style.right = '24px';
        element.style.top = 'auto';
        element.style.bottom = '24px';
    }

    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        // Don't start drag if clicking on controls or resize handle
        if (e.target.closest('#camera-controls') || 
            e.target.closest('#camera-minimized-controls') ||
            e.target.closest('button') || 
            e.target.closest('#camera-resize-handle')) {
            return;
        }
        
        // Don't drag if minimized or maximized
        if (state.cameraWindowState === 'minimized' || state.cameraWindowState === 'maximized') {
            return;
        }

        // Get current mouse/touch position
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }

        // Get current element position and cache dimensions
        const currentRect = element.getBoundingClientRect();
        initialLeft = currentRect.left;
        initialTop = currentRect.top;
        elementWidth = currentRect.width;
        elementHeight = currentRect.height;

        if (e.target === element || element.contains(e.target)) {
            isDragging = true;
            element.style.cursor = 'grabbing';
            element.style.userSelect = 'none';
            
            // Disable CSS transitions during drag for smooth movement
            element.style.transition = 'none';
            element.style.willChange = 'transform';
            
            // Prevent text selection while dragging
            e.preventDefault();
        }
    }

    function drag(e) {
        if (!isDragging) return;

        e.preventDefault();

        let currentX, currentY;
        
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        // Calculate new position based on mouse movement
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;
        
        // Constrain to viewport using cached dimensions
        const minLeft = 0;
        const maxLeft = window.innerWidth - elementWidth;
        const minTop = 0;
        const maxTop = window.innerHeight - elementHeight;
        
        newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
        newTop = Math.max(minTop, Math.min(newTop, maxTop));
        
        // Apply position directly (transitions already disabled during drag)
        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        
        // Save position (throttle state updates)
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                state.cameraWindowPosition.x = newLeft;
                state.cameraWindowPosition.y = newTop;
                rafId = null;
            });
        }
    }

    function dragEnd() {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'grab';
            element.style.userSelect = '';
            
            // Re-enable CSS transitions after a small delay to avoid jump
            setTimeout(() => {
                element.style.transition = '';
                element.style.willChange = 'auto';
            }, 50);
            
            // Cancel any pending animation frame
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }
    }

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    // Set cursor style
    element.style.cursor = 'grab';
}

// Check if camera API is available
function isCameraSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Check if we're in a secure context (required for camera)
function isSecureContext() {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// Show user-friendly error message
function showCameraError(message) {
    showAlert(`Camera Error: ${message}\n\nPlease ensure:\n- You're using a modern browser (Chrome, Firefox, Edge, Safari)\n- The page is served over HTTPS or localhost\n- You grant camera permissions when prompted`, 'Camera Error');
}

export async function startCamera() {
    console.log('startCamera called');
    
    // Prevent multiple simultaneous attempts
    if (isStarting) {
        console.warn('Camera start already in progress');
        return;
    }

    // Check if camera is already active
    if (state.isCameraActive && state.cameraStream) {
        console.warn('Camera is already active');
        return;
    }

    // Validate browser support
    if (!isCameraSupported()) {
        console.error('Camera not supported');
        showCameraError('Camera is not supported in this browser. Please use Chrome, Firefox, Edge, or Safari.');
        return;
    }

    // Validate secure context
    if (!isSecureContext()) {
        console.error('Not in secure context');
        showCameraError('Camera requires a secure context (HTTPS or localhost).');
        return;
    }

    isStarting = true;
    console.log('Starting camera...');

    try {
        // Clean up any existing camera stream before starting new one
        if (state.cameraStream) {
            stopCameraLogic();
        }

        console.log('Requesting user media...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: true
        });

        console.log('User media obtained:', mediaStream);

        // Check if stream has video tracks
        if (!mediaStream || !mediaStream.getVideoTracks().length) {
            throw new Error('No video track in camera stream');
        }

        // Mute audio by default
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks.forEach(track => {
                track.enabled = false; // Muted by default
            });
        }
        state.isAudioMuted = true;

        state.cameraStream = mediaStream;
        state.isCameraActive = true;
        console.log('Camera stream stored in state');
        
        if (cameraVideoElem) {
            console.log('Setting camera video element srcObject');
            cameraVideoElem.srcObject = mediaStream;
            // Mute to prevent feedback (users shouldn't hear themselves)
            cameraVideoElem.muted = true;
            // Ensure video plays
            cameraVideoElem.play().catch(err => {
                console.warn('Camera video play error:', err);
            });
        } else {
            console.error('Camera video element not found!');
        }
        
        if (cameraContainer) {
            cameraContainer.classList.remove('hidden');
            // Restore size and position
            restoreCameraSize();
            // Update restore button visibility
            updateRestoreButtonVisibility();
            console.log('Camera container shown');
        } else {
            console.warn('Camera container not found');
        }
        
        if (cameraControls) {
            cameraControls.classList.remove('hidden');
            // Show controls initially, they'll fade on hover
            cameraControls.style.opacity = '1';
            console.log('Camera controls shown');
        } else {
            console.warn('Camera controls not found');
        }

        // Update mute button state
        updateMuteButton();
        updateHideButton();
        
        // Update participants panel with local camera
        if (window.updateParticipantCamera) {
            setTimeout(() => {
                window.updateParticipantCamera('local', mediaStream);
            }, 100);
        }

        console.log('Camera started successfully');

        // If collaborating, share the camera stream with connected peers
        setTimeout(() => {
            if (state.isCollaborating && window.shareCameraWithPeers) {
                window.shareCameraWithPeers(mediaStream);
            }
            // Update participants panel to show local camera
            if (window.updateParticipantsPanel) {
                window.updateParticipantsPanel();
            }
        }, 100);
        
        // Import shareCameraWithPeers if not available
        if (state.isCollaborating && !window.shareCameraWithPeers) {
            import('./collaboration/videoCall.js').then(module => {
                if (module.shareCameraWithPeers) {
                    window.shareCameraWithPeers = module.shareCameraWithPeers;
                    window.shareCameraWithPeers(mediaStream);
                    // Update participants panel
                    if (window.updateParticipantsPanel) {
                        window.updateParticipantsPanel();
                    }
                }
            });
        }

        // Detect when camera track ends
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.onended = () => {
                stopCamera();
            };
        }
    } catch (err) {
        console.error("Error starting camera:", err);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to start camera.';
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera permission was denied. Please allow camera access in your browser settings and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Unable to access camera. Another application may be using it.';
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
            errorMessage = 'Camera constraints could not be satisfied.';
        } else if (err.name === 'AbortError') {
            errorMessage = 'Camera access was cancelled.';
        } else if (err.message) {
            errorMessage = `Camera error: ${err.message}`;
        }
        
        showCameraError(errorMessage);
    } finally {
        isStarting = false;
    }
}

export function stopCamera() {
    stopCameraLogic();
}

export function stopCameraLogic() {
    // If collaborating, notify peers that camera stopped
    if (state.isCollaborating && state.calls && state.calls.size > 0 && window.shareCameraWithPeers) {
        // Share null to indicate camera stopped
        window.shareCameraWithPeers(null);
    }
    
    // Update participants panel
    if (window.updateParticipantsPanel) {
        window.updateParticipantsPanel();
    }

    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
    
    state.isCameraActive = false;
    state.isAudioMuted = true;
    state.isCameraHidden = false;
    
    if (cameraVideoElem) {
        cameraVideoElem.srcObject = null;
        cameraVideoElem.style.display = 'block'; // Reset display
    }
    
    // Update participants panel - remove local camera
    if (window.updateParticipantCamera) {
        setTimeout(() => {
            window.updateParticipantCamera('local', null);
        }, 100);
    }
    
    if (cameraContainer) {
        cameraContainer.classList.add('hidden');
        // Reset window state
        cameraContainer.classList.remove('camera-minimized', 'camera-maximized');
        state.cameraWindowState = 'normal';
    }
    
    if (cameraControls) {
        cameraControls.classList.add('hidden');
    }
    
    // Hide minimized controls
    const minimizedControls = document.getElementById('camera-minimized-controls');
    if (minimizedControls) {
        minimizedControls.classList.add('hidden');
    }
    
    // Hide restore button in header
    updateRestoreButtonVisibility();
}

export function toggleAudio() {
    if (!state.cameraStream || !state.isCameraActive) return;
    
    const audioTracks = state.cameraStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    state.isAudioMuted = !state.isAudioMuted;
    
    audioTracks.forEach(track => {
        track.enabled = !state.isAudioMuted;
    });
    
    updateMuteButton();
    console.log(`Audio ${state.isAudioMuted ? 'muted' : 'unmuted'}`);
}

function updateMuteButton() {
    const muteIcon = document.getElementById('camera-icon-mute');
    const unmuteIcon = document.getElementById('camera-icon-unmute');
    
    if (muteIcon && unmuteIcon) {
        if (state.isAudioMuted) {
            muteIcon.classList.remove('hidden');
            unmuteIcon.classList.add('hidden');
        } else {
            muteIcon.classList.add('hidden');
            unmuteIcon.classList.remove('hidden');
        }
    }
}

export function toggleCameraMinimize() {
    if (!cameraContainer) return;
    
    if (state.cameraWindowState === 'minimized') {
        // Restore from minimized
        restoreFromMinimized();
    } else {
        // If maximized, restore first
        if (state.cameraWindowState === 'maximized') {
            cameraContainer.classList.remove('camera-maximized');
            updateMaximizeButton();
        }
        
        // Minimize
        state.cameraWindowState = 'minimized';
        cameraContainer.classList.add('camera-minimized');
        cameraContainer.style.width = '60px';
        cameraContainer.style.height = '60px';
        
        // Hide camera container when minimized
        cameraContainer.classList.add('hidden');
        
        // Show restore button in header
        updateRestoreButtonVisibility();
    }
}

export function restoreFromMinimized() {
    if (!cameraContainer) return;
    
    state.cameraWindowState = 'normal';
    cameraContainer.classList.remove('camera-minimized');
    
    // Show camera container
    cameraContainer.classList.remove('hidden');
    
    restoreCameraSize();
    
    // Hide minimized controls, show normal controls
    const minimizedControls = document.getElementById('camera-minimized-controls');
    const normalControls = document.getElementById('camera-controls');
    if (minimizedControls) minimizedControls.classList.add('hidden');
    if (normalControls) normalControls.classList.remove('hidden');
    
    // Hide restore button in header
    updateRestoreButtonVisibility();
}

function updateRestoreButtonVisibility() {
    const restoreButton = document.getElementById('btn-camera-restore-header');
    if (restoreButton) {
        if (state.cameraWindowState === 'minimized' && state.isCameraActive) {
            restoreButton.classList.remove('hidden');
        } else {
            restoreButton.classList.add('hidden');
        }
    }
}

// Make updateRestoreButtonVisibility available globally for UI module
window.updateRestoreButtonVisibility = updateRestoreButtonVisibility;

export function toggleCameraHide() {
    if (!cameraVideoElem) return;
    
    state.isCameraHidden = !state.isCameraHidden;
    
    if (state.isCameraHidden) {
        cameraVideoElem.style.display = 'none';
    } else {
        cameraVideoElem.style.display = 'block';
    }
    
    updateHideButton();
}

function updateHideButton() {
    const hideIcon = document.getElementById('camera-icon-hide');
    const showIcon = document.getElementById('camera-icon-show');
    
    if (hideIcon && showIcon) {
        if (state.isCameraHidden) {
            hideIcon.classList.add('hidden');
            showIcon.classList.remove('hidden');
        } else {
            hideIcon.classList.remove('hidden');
            showIcon.classList.add('hidden');
        }
    }
}

export function toggleCameraMaximize() {
    if (!cameraContainer) return;
    
    if (state.cameraWindowState === 'maximized') {
        // Restore from maximized
        state.cameraWindowState = 'normal';
        cameraContainer.classList.remove('camera-maximized');
        restoreCameraSize();
        updateMaximizeButton();
    } else {
        // If minimized, restore first
        if (state.cameraWindowState === 'minimized') {
            cameraContainer.classList.remove('camera-minimized');
        }
        
        // Save current size before maximizing
        const rect = cameraContainer.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            state.cameraWindowSize.width = rect.width;
            state.cameraWindowSize.height = rect.height;
        }
        
        // Save current position
        state.cameraWindowPosition.x = rect.left;
        state.cameraWindowPosition.y = rect.top;
        
        // Maximize
        state.cameraWindowState = 'maximized';
        cameraContainer.classList.add('camera-maximized');
        
        // Set to full viewport
        cameraContainer.style.width = '100vw';
        cameraContainer.style.height = '100vh';
        cameraContainer.style.left = '0';
        cameraContainer.style.top = '0';
        cameraContainer.style.right = 'auto';
        cameraContainer.style.bottom = 'auto';
        
        updateMaximizeButton();
    }
}

function restoreCameraSize() {
    if (!cameraContainer) return;
    
    if (state.cameraWindowState === 'normal') {
        cameraContainer.style.width = `${state.cameraWindowSize.width}px`;
        cameraContainer.style.height = `${state.cameraWindowSize.height}px`;
        
        // Restore position if saved
        if (state.cameraWindowPosition.x !== null && state.cameraWindowPosition.y !== null) {
            cameraContainer.style.left = `${state.cameraWindowPosition.x}px`;
            cameraContainer.style.top = `${state.cameraWindowPosition.y}px`;
            cameraContainer.style.right = 'auto';
            cameraContainer.style.bottom = 'auto';
        } else {
            // Use default bottom-right
            cameraContainer.style.left = 'auto';
            cameraContainer.style.right = '24px';
            cameraContainer.style.top = 'auto';
            cameraContainer.style.bottom = '24px';
        }
    }
}

function updateMaximizeButton() {
    const maximizeIcon = document.getElementById('camera-icon-maximize');
    const restoreIcon = document.getElementById('camera-icon-restore');
    
    if (maximizeIcon && restoreIcon) {
        if (state.cameraWindowState === 'maximized') {
            maximizeIcon.classList.add('hidden');
            restoreIcon.classList.remove('hidden');
        } else {
            maximizeIcon.classList.remove('hidden');
            restoreIcon.classList.add('hidden');
        }
    }
}

// Initialize resize functionality
export function initCameraResize() {
    if (!cameraContainer) return;
    
    const resizeHandle = document.getElementById('camera-resize-handle');
    if (!resizeHandle) return;
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        if (state.cameraWindowState === 'maximized' || state.cameraWindowState === 'minimized') {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        
        const rect = cameraContainer.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Calculate new size (resize from bottom-right)
        const newWidth = Math.max(180, Math.min(800, startWidth + deltaX));
        const newHeight = Math.max(135, Math.min(600, startHeight + deltaY));
        
        // Maintain aspect ratio (optional - can be removed for free resize)
        // const aspectRatio = startWidth / startHeight;
        // const heightFromWidth = newWidth / aspectRatio;
        // const widthFromHeight = newHeight * aspectRatio;
        // const finalWidth = Math.abs(deltaX) > Math.abs(deltaY) ? newWidth : widthFromHeight;
        // const finalHeight = Math.abs(deltaX) > Math.abs(deltaY) ? heightFromWidth : newHeight;
        
        cameraContainer.style.width = `${newWidth}px`;
        cameraContainer.style.height = `${newHeight}px`;
        
        // Save new size
        state.cameraWindowSize.width = newWidth;
        state.cameraWindowSize.height = newHeight;
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

// Make shareCameraWithPeers available globally for collaboration module
window.shareCameraWithPeers = null;

