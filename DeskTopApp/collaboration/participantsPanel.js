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
export function getDisplayName(peerId) {
    if (peerId === 'local' || peerId === state.myPeerId) {
        return 'You';
    }
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
    
    // Mic mute indicator (Teams-style)
    const micIndicator = document.createElement('div');
    micIndicator.id = `participant-mic-indicator-${peerId}`;
    micIndicator.className = 'absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded';
    micIndicator.style.display = 'none';
    
    const micIcon = document.createElement('i');
    micIcon.id = `participant-mic-icon-${peerId}`;
    micIcon.className = 'fas fa-microphone text-white text-xs';
    micIndicator.appendChild(micIcon);
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(avatar);
    videoContainer.appendChild(nameLabel);
    videoContainer.appendChild(cameraIndicator);
    videoContainer.appendChild(micIndicator);
    card.appendChild(videoContainer);
    
    // Controls bar (Teams-style) - only for local user
    if (isLocal || peerId === 'local') {
        const controlsBar = document.createElement('div');
        controlsBar.className = 'participant-controls-bar p-2 bg-gray-800 border-t border-gray-700 flex items-center justify-center gap-2';
        
        // Mic mute button
        const micBtn = document.createElement('button');
        micBtn.id = `participant-mic-btn-${peerId}`;
        micBtn.className = 'p-2 rounded-lg transition-colors hover:bg-gray-700';
        micBtn.title = 'Mute/Unmute';
        const micBtnIcon = document.createElement('i');
        micBtnIcon.id = `participant-mic-btn-icon-${peerId}`;
        micBtnIcon.className = 'fas fa-microphone-slash text-red-500';
        micBtn.appendChild(micBtnIcon);
        micBtn.addEventListener('click', () => {
            toggleLocalMic();
        });
        controlsBar.appendChild(micBtn);
        
        // Device settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.id = `participant-settings-btn-${peerId}`;
        settingsBtn.className = 'p-2 rounded-lg transition-colors hover:bg-gray-700';
        settingsBtn.title = 'Device Settings';
        const settingsBtnIcon = document.createElement('i');
        settingsBtnIcon.className = 'fas fa-cog text-gray-400';
        settingsBtn.appendChild(settingsBtnIcon);
        settingsBtn.addEventListener('click', () => {
            openDeviceSettings();
        });
        controlsBar.appendChild(settingsBtn);
        
        card.appendChild(controlsBar);
    }
    
    return card;
}

// Toggle local mic mute
function toggleLocalMic() {
    if (!state.cameraStream || !state.isCameraActive) return;
    
    const audioTracks = state.cameraStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    state.isAudioMuted = !state.isAudioMuted;
    
    audioTracks.forEach(track => {
        track.enabled = !state.isAudioMuted;
    });
    
    // Update UI
    updateLocalMicIndicator();
    
    // If collaborating, update peer connections with new audio track state
    if (state.isCollaborating && window.shareCameraWithPeers) {
        window.shareCameraWithPeers(state.cameraStream);
    }
}

// Update local mic indicator
function updateLocalMicIndicator() {
    const micBtn = document.getElementById('participant-mic-btn-local');
    const micBtnIcon = document.getElementById('participant-mic-btn-icon-local');
    const micIndicator = document.getElementById('participant-mic-indicator-local');
    const micIcon = document.getElementById('participant-mic-icon-local');
    
    if (micBtnIcon) {
        if (state.isAudioMuted) {
            micBtnIcon.className = 'fas fa-microphone-slash text-red-500';
            micBtn.title = 'Unmute';
        } else {
            micBtnIcon.className = 'fas fa-microphone text-green-500';
            micBtn.title = 'Mute';
        }
    }
    
    if (micIndicator && micIcon) {
        if (state.isAudioMuted) {
            micIndicator.style.display = 'flex';
            micIcon.className = 'fas fa-microphone-slash text-red-500 text-xs';
        } else {
            micIndicator.style.display = 'none';
        }
    }
}

// Open device settings modal
function openDeviceSettings() {
    const modal = document.getElementById('device-selection-modal-overlay');
    if (modal && window.populateDeviceSelects) {
        modal.classList.remove('hidden');
        window.populateDeviceSelects();
    }
}

// Make functions available globally
window.toggleLocalMic = toggleLocalMic;
window.updateLocalMicIndicator = updateLocalMicIndicator;
window.openDeviceSettings = openDeviceSettings;

// Update participant video
export function updateParticipantCamera(peerId, stream) {
    const card = document.getElementById(`participant-${peerId}`);
    if (!card) return;
    
    const video = document.getElementById(`participant-video-${peerId}`);
    const avatar = document.getElementById(`participant-avatar-${peerId}`);
    const indicator = document.getElementById(`participant-camera-indicator-${peerId}`);
    const micIndicator = document.getElementById(`participant-mic-indicator-${peerId}`);
    
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
                    console.error('Error playing participant video:', err);
                }
            });
        }
        if (avatar) avatar.classList.add('hidden');
        if (indicator) indicator.classList.remove('hidden');
        peerCameraStreams.set(peerId, stream);
        
        // Update mic indicator for local user
        if (peerId === 'local' && micIndicator) {
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0 && state.isAudioMuted) {
                micIndicator.style.display = 'flex';
            } else {
                micIndicator.style.display = 'none';
            }
        }
    } else {
        // Hide video, show avatar
        if (video) {
            video.srcObject = null;
            video.classList.add('hidden');
        }
        if (avatar) avatar.classList.remove('hidden');
        if (indicator) indicator.classList.add('hidden');
        if (micIndicator) micIndicator.style.display = 'none';
        peerCameraStreams.delete(peerId);
    }
}

// Update participants panel
export function updateParticipantsPanel() {
    const panel = document.getElementById('participants-panel');
    const list = document.getElementById('participants-list');
    const btnParticipants = document.getElementById('btn-participants');
    
    if (!panel || !list) {
        return;
    }
    
    // Only show panel button and allow panel when collaborating
    if (!state.isCollaborating) {
        panel.classList.add('hidden');
        if (btnParticipants) {
            btnParticipants.style.display = 'none';
        }
        return;
    }
    
    // Update button visibility
    updateParticipantsButton();
    
    // Show or hide panel based on user preference (default to visible on first collaboration)
    if (state.participantsPanelVisible === undefined) {
        state.participantsPanelVisible = true; // Default to visible
    }
    
    if (state.participantsPanelVisible) {
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
    
    // Handle backdrop for mobile
    updateBackdrop();
    
    // Setup tabs if not already done
    setupTabs();
    
    // Setup panel resize if not already done
    setupPanelResize();
    
    // Setup backdrop if not already done
    setupBackdrop();
    
    // Handle window resize to update backdrop
    if (!window.participantsPanelResizeHandler) {
        window.participantsPanelResizeHandler = () => {
            updateBackdrop();
        };
        window.addEventListener('resize', window.participantsPanelResizeHandler);
    }
    
    // Ensure correct view is shown based on active tab
    const tabParticipants = document.getElementById('tab-participants');
    const tabChat = document.getElementById('tab-chat');
    const participantsView = document.getElementById('participants-view');
    const chatView = document.getElementById('chat-view');
    
    if (tabParticipants && tabChat && participantsView && chatView) {
        // Check which tab is active (default to participants if neither is explicitly active)
        const isParticipantsActive = tabParticipants.classList.contains('tab-active') || 
                                     (!tabChat.classList.contains('tab-active') && !tabParticipants.classList.contains('tab-active'));
        
        if (isParticipantsActive) {
            // Show participants, hide chat
            participantsView.classList.remove('hidden');
            chatView.classList.add('hidden');
            // Ensure tab styling is correct
            tabParticipants.classList.add('tab-active', 'text-white');
            tabParticipants.classList.remove('text-gray-400', 'text-gray-300');
            tabChat.classList.remove('tab-active', 'text-white');
            tabChat.classList.add('text-gray-400');
        } else {
            // Show chat, hide participants
            chatView.classList.remove('hidden');
            participantsView.classList.add('hidden');
            // Ensure tab styling is correct
            tabChat.classList.add('tab-active', 'text-white');
            tabChat.classList.remove('text-gray-400');
            tabParticipants.classList.remove('tab-active', 'text-white');
            tabParticipants.classList.add('text-gray-300');
        }
    }
    
    // Initialize chat if not already done
    if (window.initChat && !window.chatInitialized) {
        window.initChat();
        window.chatInitialized = true;
    }
    
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
    
    // Update local mic indicator
    updateLocalMicIndicator();
    
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
}

// Setup tab switching
function setupTabs() {
    const tabParticipants = document.getElementById('tab-participants');
    const tabChat = document.getElementById('tab-chat');
    const participantsView = document.getElementById('participants-view');
    const chatView = document.getElementById('chat-view');
    
    if (!tabParticipants || !tabChat || !participantsView || !chatView) {
        // Retry after a short delay if elements aren't ready
        setTimeout(setupTabs, 100);
        return;
    }
    
    // Check if already set up
    if (tabParticipants.dataset.setup === 'true') {
        return;
    }
    
    // Participants tab click
    tabParticipants.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Update tab styles
        tabParticipants.classList.add('tab-active');
        tabParticipants.classList.remove('text-gray-400');
        tabParticipants.classList.add('text-white');
        tabChat.classList.remove('tab-active');
        tabChat.classList.remove('text-white');
        tabChat.classList.add('text-gray-400');
        
        // Show participants view, hide chat view
        if (participantsView) {
            participantsView.classList.remove('hidden');
        }
        if (chatView) {
            chatView.classList.add('hidden');
        }
        
        // Update unread badge visibility
        if (window.updateUnreadBadge) {
            window.updateUnreadBadge();
        }
    });
    
    // Chat tab click
    tabChat.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Update tab styles
        tabChat.classList.add('tab-active');
        tabChat.classList.remove('text-gray-400');
        tabChat.classList.add('text-white');
        tabParticipants.classList.remove('tab-active');
        tabParticipants.classList.remove('text-white');
        tabParticipants.classList.add('text-gray-300');
        
        // Show chat view, hide participants view
        if (chatView) {
            chatView.classList.remove('hidden');
        }
        if (participantsView) {
            participantsView.classList.add('hidden');
        }
        
        // Clear unread count when switching to chat
        if (window.clearUnreadCount) {
            window.clearUnreadCount();
        }
        
        // Scroll to bottom
        setTimeout(() => {
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
    });
    
    // Mark as set up
    tabParticipants.dataset.setup = 'true';
}

// Get remote camera streams from window (set by videoCall.js)
function getRemoteCameraStreams() {
    return window.remoteCameraStreams || new Map();
}

// Setup panel resize functionality
function setupPanelResize() {
    const panel = document.getElementById('participants-panel');
    const resizeHandle = document.getElementById('participants-panel-resize-handle');
    
    if (!panel || !resizeHandle) {
        // Retry if elements aren't ready
        setTimeout(setupPanelResize, 100);
        return;
    }
    
    // Check if already set up
    if (resizeHandle.dataset.setup === 'true') {
        return;
    }
    
    // Restore saved width if available
    if (state.participantsPanelWidth) {
        panel.style.width = `${state.participantsPanelWidth}px`;
    }
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Minimum and maximum widths
    const MIN_WIDTH = 240; // Minimum width
    const MAX_WIDTH = 800; // Maximum width
    
    const handleMouseDown = (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        resizeHandle.classList.add('resizing');
        document.body.classList.add('resizing-panel');
        
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const diff = startX - e.clientX; // Inverted because panel is on the right
        let newWidth = startWidth + diff;
        
        // Constrain width
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        
        // Update panel width
        panel.style.width = `${newWidth}px`;
        
        // Update state
        state.participantsPanelWidth = newWidth;
    };
    
    const handleMouseUp = () => {
        if (!isResizing) return;
        
        isResizing = false;
        resizeHandle.classList.remove('resizing');
        document.body.classList.remove('resizing-panel');
    };
    
    // Add event listeners
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Also handle mouse leave to stop resizing if mouse leaves window
    document.addEventListener('mouseleave', handleMouseUp);
    
    // Mark as set up
    resizeHandle.dataset.setup = 'true';
}

// Update participants button visibility
function updateParticipantsButton() {
    const btnParticipants = document.getElementById('btn-participants');
    if (!btnParticipants) return;
    
    // Only show button when collaborating
    if (state.isCollaborating) {
        btnParticipants.style.display = 'block';
        // Update title based on panel visibility
        const panel = document.getElementById('participants-panel');
        if (panel) {
            const isVisible = !panel.classList.contains('hidden');
            btnParticipants.title = isVisible ? 'Hide Participants' : 'Show Participants';
        }
    } else {
        btnParticipants.style.display = 'none';
    }
}

// Update backdrop visibility for mobile
function updateBackdrop() {
    const backdrop = document.getElementById('participants-panel-backdrop');
    const panel = document.getElementById('participants-panel');
    
    if (!backdrop || !panel) return;
    
    // Only show backdrop on mobile and when panel is visible
    const isMobile = window.innerWidth <= 768;
    const isPanelVisible = !panel.classList.contains('hidden') && state.participantsPanelVisible;
    
    if (isMobile && isPanelVisible && state.isCollaborating) {
        backdrop.classList.remove('hidden');
    } else {
        backdrop.classList.add('hidden');
    }
}

// Setup backdrop click handler
function setupBackdrop() {
    const backdrop = document.getElementById('participants-panel-backdrop');
    if (!backdrop) return;
    
    // Check if already set up
    if (backdrop.dataset.setup === 'true') {
        return;
    }
    
    backdrop.addEventListener('click', () => {
        // Close panel when backdrop is clicked
        if (state.isCollaborating && state.participantsPanelVisible) {
            state.participantsPanelVisible = false;
            updateParticipantsPanel();
        }
    });
    
    // Mark as set up
    backdrop.dataset.setup = 'true';
}

// Make functions available globally
window.updateParticipantsPanel = updateParticipantsPanel;
window.updateParticipantCamera = updateParticipantCamera;
window.setupTabs = setupTabs;
window.setupPanelResize = setupPanelResize;
window.updateParticipantsButton = updateParticipantsButton;
window.updateBackdrop = updateBackdrop;
window.getDisplayName = getDisplayName;

