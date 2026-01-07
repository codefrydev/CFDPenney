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
    console.log('[updateParticipantsPanel] Function called');
    const panel = document.getElementById('participants-panel');
    const list = document.getElementById('participants-list');
    const btnParticipants = document.getElementById('btn-participants');
    
    console.log('[updateParticipantsPanel] Panel found:', !!panel);
    console.log('[updateParticipantsPanel] List found:', !!list);
    console.log('[updateParticipantsPanel] Button found:', !!btnParticipants);
    
    if (!panel || !list) {
        console.warn('[updateParticipantsPanel] Panel or list not found, returning');
        return;
    }
    
    console.log('[updateParticipantsPanel] state.isCollaborating:', state.isCollaborating);
    console.log('[updateParticipantsPanel] state.participantsPanelVisible:', state.participantsPanelVisible);
    console.log('[updateParticipantsPanel] Panel classes before update:', panel.className);
    
    // Only show panel button and allow panel when collaborating
    if (!state.isCollaborating) {
        console.log('[updateParticipantsPanel] Not collaborating, hiding panel');
        panel.classList.add('hidden');
        if (btnParticipants) {
            btnParticipants.classList.add('hidden');
        }
        return;
    }
    
    // Update button visibility
    updateParticipantsButton();
    
    // Show or hide panel based on user preference (default to visible on first collaboration)
    if (state.participantsPanelVisible === undefined) {
        console.log('[updateParticipantsPanel] participantsPanelVisible is undefined, setting to true (default)');
        state.participantsPanelVisible = true; // Default to visible
    }
    
    console.log('[updateParticipantsPanel] Final state.participantsPanelVisible:', state.participantsPanelVisible);
    
    if (state.participantsPanelVisible) {
        console.log('[updateParticipantsPanel] Showing panel (removing hidden class)');
        panel.classList.remove('hidden');
    } else {
        console.log('[updateParticipantsPanel] Hiding panel (adding hidden class)');
        panel.classList.add('hidden');
    }
    
    console.log('[updateParticipantsPanel] Panel classes after update:', panel.className);
    console.log('[updateParticipantsPanel] Panel has hidden class:', panel.classList.contains('hidden'));
    const computedStyle = window.getComputedStyle(panel);
    console.log('[updateParticipantsPanel] Panel computed display:', computedStyle.display);
    console.log('[updateParticipantsPanel] Panel computed visibility:', computedStyle.visibility);
    
    // Setup tabs if not already done
    setupTabs();
    
    // Setup panel resize if not already done
    setupPanelResize();
    
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

// Setup tab switching
function setupTabs() {
    const tabParticipants = document.getElementById('tab-participants');
    const tabChat = document.getElementById('tab-chat');
    const participantsView = document.getElementById('participants-view');
    const chatView = document.getElementById('chat-view');
    
    if (!tabParticipants || !tabChat || !participantsView || !chatView) {
        console.warn('Tab elements not found, retrying...');
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
    console.log('Tabs setup complete');
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
        btnParticipants.classList.remove('hidden');
        // Update title based on panel visibility
        const panel = document.getElementById('participants-panel');
        if (panel) {
            const isVisible = !panel.classList.contains('hidden');
            btnParticipants.title = isVisible ? 'Hide Participants' : 'Show Participants';
        }
    } else {
        btnParticipants.classList.add('hidden');
    }
}

// Make functions available globally
window.updateParticipantsPanel = updateParticipantsPanel;
window.updateParticipantCamera = updateParticipantCamera;
window.setupTabs = setupTabs;
window.setupPanelResize = setupPanelResize;
window.updateParticipantsButton = updateParticipantsButton;

