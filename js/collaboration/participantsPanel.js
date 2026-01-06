// Participants Panel Management (Teams-style)
import { state } from '../state.js';

// Store peer camera streams for participants panel
const peerCameraStreams = new Map(); // Map<peerId, stream>

// Generate avatar color from peer ID
function getAvatarColor(peerId) {
    const colors = [
        '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
        '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF6B6B'
    ];
    if (!peerId) return colors[0];
    const hash = peerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// Get initials from peer ID or name
function getInitials(peerId) {
    if (!peerId) return '?';
    // Try to extract name if available
    const peerInfo = state.connectedPeers.get(peerId);
    if (peerInfo && peerInfo.name) {
        const parts = peerInfo.name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0][0].toUpperCase();
    }
    // Fallback to first two characters of peer ID
    return peerId.substring(0, 2).toUpperCase();
}

// Get display name for peer
function getDisplayName(peerId) {
    const peerInfo = state.connectedPeers.get(peerId);
    if (peerInfo && peerInfo.name) {
        return peerInfo.name;
    }
    // Generate a friendly name from peer ID
    return `User ${peerId.substring(0, 6)}`;
}

// Create participant card
function createParticipantCard(peerId, isLocal = false) {
    const card = document.createElement('div');
    card.id = `participant-${peerId}`;
    card.className = 'participant-card bg-gray-700 rounded-lg overflow-hidden transition-all duration-200 hover:bg-gray-600';
    
    const videoContainer = document.createElement('div');
    videoContainer.className = 'relative w-full aspect-video bg-gray-900';
    
    // Video element (hidden initially)
    const video = document.createElement('video');
    video.id = `participant-video-${peerId}`;
    video.autoplay = true;
    video.playsInline = true;
    // Mute only local user's video to prevent echo/feedback
    // Remote users' videos should NOT be muted so users can hear others
    video.muted = isLocal || peerId === 'local';
    video.className = 'w-full h-full object-cover hidden';
    
    // Avatar (shown when no video)
    const avatar = document.createElement('div');
    avatar.id = `participant-avatar-${peerId}`;
    avatar.className = 'absolute inset-0 flex items-center justify-center';
    const avatarColor = getAvatarColor(peerId);
    avatar.style.backgroundColor = avatarColor;
    
    const initials = document.createElement('div');
    initials.className = 'text-3xl font-bold text-white';
    if (isLocal) {
        initials.textContent = 'You';
    } else if (peerId === 'local') {
        initials.textContent = 'You';
    } else {
        initials.textContent = getInitials(peerId);
    }
    avatar.appendChild(initials);
    
    // Name label
    const nameLabel = document.createElement('div');
    nameLabel.className = 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2';
    const nameText = document.createElement('span');
    nameText.className = 'text-white text-sm font-medium';
    if (isLocal || peerId === 'local') {
        nameText.textContent = 'You';
    } else {
        nameText.textContent = getDisplayName(peerId);
    }
    nameLabel.appendChild(nameText);
    
    // Camera indicator
    const cameraIndicator = document.createElement('div');
    cameraIndicator.id = `participant-camera-indicator-${peerId}`;
    cameraIndicator.className = 'absolute top-2 right-2 bg-green-500 w-3 h-3 rounded-full hidden';
    cameraIndicator.title = 'Camera on';
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(avatar);
    videoContainer.appendChild(nameLabel);
    videoContainer.appendChild(cameraIndicator);
    card.appendChild(videoContainer);
    
    return card;
}

// Update participant video
export function updateParticipantCamera(peerId, stream) {
    const card = document.getElementById(`participant-${peerId}`);
    if (!card) return;
    
    const video = document.getElementById(`participant-video-${peerId}`);
    const avatar = document.getElementById(`participant-avatar-${peerId}`);
    const indicator = document.getElementById(`participant-camera-indicator-${peerId}`);
    
    if (stream && stream.getVideoTracks().length > 0) {
        // Show video, hide avatar
        if (video) {
            video.srcObject = stream;
            // Mute only local user's video to prevent echo/feedback
            // Remote users' videos should NOT be muted so users can hear others
            const isLocal = peerId === 'local';
            video.muted = isLocal;
            video.classList.remove('hidden');
            video.play().catch(err => {
                if (err.name !== 'AbortError') {
                    console.warn(`Error playing participant video for ${peerId}:`, err);
                }
            });
        }
        if (avatar) avatar.classList.add('hidden');
        if (indicator) indicator.classList.remove('hidden');
        peerCameraStreams.set(peerId, stream);
    } else {
        // Hide video, show avatar
        if (video) {
            video.srcObject = null;
            video.classList.add('hidden');
        }
        if (avatar) avatar.classList.remove('hidden');
        if (indicator) indicator.classList.add('hidden');
        peerCameraStreams.delete(peerId);
    }
}

// Update participants panel
export function updateParticipantsPanel() {
    const panel = document.getElementById('participants-panel');
    const list = document.getElementById('participants-list');
    
    if (!panel || !list) return;
    
    if (!state.isCollaborating) {
        panel.classList.add('hidden');
        return;
    }
    
    // Auto-show panel when collaborating (like Teams)
    panel.classList.remove('hidden');
    
    // Clear existing list
    list.innerHTML = '';
    
    // Add yourself first (use 'local' as ID for consistency)
    const localPeerId = 'local';
    const localCard = createParticipantCard(localPeerId, true);
    list.appendChild(localCard);
    
    // Update local camera if active
    if (state.isCameraActive && state.cameraStream) {
        updateParticipantCamera(localPeerId, state.cameraStream);
    } else {
        updateParticipantCamera(localPeerId, null);
    }
    
    // Add all connected peers
    state.connectedPeers.forEach((peerInfo, peerId) => {
        const card = createParticipantCard(peerId, false);
        list.appendChild(card);
        
        // Check if this peer has an active camera stream
        const remoteStreams = getRemoteCameraStreams();
        if (remoteStreams && remoteStreams instanceof Map) {
            const cameraData = remoteStreams.get(peerId);
            if (cameraData) {
                const stream = cameraData.stream || cameraData; // Handle both {stream: ...} and direct stream
                if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
                    updateParticipantCamera(peerId, stream);
                } else {
                    updateParticipantCamera(peerId, null);
                }
            } else {
                updateParticipantCamera(peerId, null);
            }
        } else {
            updateParticipantCamera(peerId, null);
        }
    });
    
    // Re-initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Get remote camera streams from window (set by videoCall.js)
function getRemoteCameraStreams() {
    return window.remoteCameraStreams || new Map();
}

// Make functions available globally
window.updateParticipantsPanel = updateParticipantsPanel;
window.updateParticipantCamera = updateParticipantCamera;

