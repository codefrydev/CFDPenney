// Chat Module for Collaboration
import { state } from '../state.js';
import { sendChatMessage, sendChatReaction } from './messageSender.js';
import { getDisplayName } from './participantsPanel.js';

// Maximum message history to keep in memory
const MAX_MESSAGE_HISTORY = 500;
// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Common emojis for picker
const COMMON_EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '👐',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '💯', '🔥', '⭐', '✨', '💫', '🌟', '💥', '💢', '💤', '💨'
];

let selectedFile = null;
let emojiPickerVisible = false;

// Initialize chat module
export function initChat() {
    setupChatEventListeners();
    setupEmojiPicker();
    updateChatUI();
}

// Setup event listeners for chat
function setupChatEventListeners() {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatFileBtn = document.getElementById('chat-file-btn');
    const chatFileInput = document.getElementById('chat-file-input');
    const chatFileRemove = document.getElementById('chat-file-remove');
    const chatEmojiBtn = document.getElementById('chat-emoji-btn');
    
    if (!chatInput || !chatSendBtn) return;
    
    // Send message on button click
    chatSendBtn.addEventListener('click', handleSendMessage);
    
    // Send message on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
    
    // File attachment
    if (chatFileBtn && chatFileInput) {
        chatFileBtn.addEventListener('click', () => {
            chatFileInput.click();
        });
        
        chatFileInput.addEventListener('change', handleFileSelect);
    }
    
    // Remove file
    if (chatFileRemove) {
        chatFileRemove.addEventListener('click', () => {
            selectedFile = null;
            updateFilePreview();
        });
    }
    
    // Emoji picker toggle
    if (chatEmojiBtn) {
        chatEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEmojiPicker();
        });
    }
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emoji-picker');
        if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== chatEmojiBtn) {
            hideEmojiPicker();
        }
    });
}

// Setup emoji picker
function setupEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    // Populate emoji grid
    COMMON_EMOJIS.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-btn p-2 hover:bg-gray-600 rounded text-lg transition-colors';
        emojiBtn.textContent = emoji;
        emojiBtn.title = emoji;
        emojiBtn.addEventListener('click', () => {
            insertEmoji(emoji);
            hideEmojiPicker();
        });
        emojiPicker.appendChild(emojiBtn);
    });
}

// Toggle emoji picker visibility
function toggleEmojiPicker() {
    emojiPickerVisible = !emojiPickerVisible;
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    if (emojiPickerVisible) {
        emojiPicker.classList.remove('hidden');
        // Position picker above input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            const rect = chatInput.getBoundingClientRect();
            emojiPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        }
    } else {
        emojiPicker.classList.add('hidden');
    }
}

// Hide emoji picker
function hideEmojiPicker() {
    emojiPickerVisible = false;
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) {
        emojiPicker.classList.add('hidden');
    }
}

// Insert emoji into input
function insertEmoji(emoji) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const cursorPos = chatInput.selectionStart;
    const textBefore = chatInput.value.substring(0, cursorPos);
    const textAfter = chatInput.value.substring(cursorPos);
    chatInput.value = textBefore + emoji + textAfter;
    chatInput.selectionStart = chatInput.selectionEnd = cursorPos + emoji.length;
    chatInput.focus();
    
    // Trigger input event for auto-resize
    chatInput.dispatchEvent(new Event('input'));
}

// Handle file selection
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        alert(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit. Please choose a smaller file.`);
        e.target.value = '';
        return;
    }
    
    selectedFile = file;
    updateFilePreview();
    
    // Reset input
    e.target.value = '';
}

// Update file preview
function updateFilePreview() {
    const preview = document.getElementById('chat-file-preview');
    const fileName = document.getElementById('chat-file-name');
    const fileSize = document.getElementById('chat-file-size');
    const filePreviewImg = document.getElementById('chat-file-preview-img');
    
    if (!preview || !fileName || !fileSize) return;
    
    if (selectedFile) {
        preview.classList.remove('hidden');
        fileName.textContent = selectedFile.name;
        fileSize.textContent = `(${(selectedFile.size / 1024).toFixed(1)} KB)`;
        
        // Show image preview if it's an image
        if (filePreviewImg && selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                filePreviewImg.src = e.target.result;
                filePreviewImg.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedFile);
        } else if (filePreviewImg) {
            filePreviewImg.classList.add('hidden');
        }
    } else {
        preview.classList.add('hidden');
        if (filePreviewImg) {
            filePreviewImg.classList.add('hidden');
        }
    }
}

// Handle sending message
async function handleSendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    if (!text && !selectedFile) return;
    
    if (!state.isCollaborating) {
        alert('You must be in a collaboration session to send messages.');
        return;
    }
    
    try {
        let fileData = null;
        
        // Handle file attachment
        if (selectedFile) {
            fileData = await convertFileToBase64(selectedFile);
        }
        
        // Create message
        const message = {
            type: 'CHAT_MESSAGE',
            text: text || '',
            file: fileData,
            fileName: selectedFile ? selectedFile.name : null,
            fileType: selectedFile ? selectedFile.type : null,
            timestamp: Date.now(),
            messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        // Send message
        const sent = sendChatMessage(message);
        
        if (sent) {
            // Add to local state immediately (optimistic update)
            const localMessage = {
                ...message,
                peerId: state.myPeerId,
                isLocal: true
            };
            addMessageToUI(localMessage);
            
            // Clear input
            chatInput.value = '';
            chatInput.style.height = 'auto';
            selectedFile = null;
            updateFilePreview();
        }
    } catch (err) {
        console.error('Error sending message:', err);
        alert('Failed to send message. Please try again.');
    }
}

// Convert file to base64
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                data: reader.result,
                name: file.name,
                type: file.type,
                size: file.size
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle incoming chat message
export function handleChatMessage(message, peerId) {
    const senderPeerId = message.peerId || peerId || 'unknown';
    
    // Check if this is our own message (already added optimistically)
    if (senderPeerId === state.myPeerId && message.messageId) {
        const existingIndex = state.chatMessages.findIndex(m => m.messageId === message.messageId);
        if (existingIndex >= 0) {
            // Message already exists, skip duplicate
            return;
        }
    }
    
    // Add message to state
    const chatMessage = {
        ...message,
        peerId: senderPeerId,
        isLocal: senderPeerId === state.myPeerId,
        timestamp: message.timestamp || Date.now()
    };
    
    // Add to messages array (limit history)
    state.chatMessages.push(chatMessage);
    if (state.chatMessages.length > MAX_MESSAGE_HISTORY) {
        state.chatMessages.shift();
    }
    
    // Update UI
    addMessageToUI(chatMessage);
    
    // Update unread count if chat view is not active
    const chatView = document.getElementById('chat-view');
    if (chatView && chatView.classList.contains('hidden')) {
        state.unreadChatCount++;
        updateUnreadBadge();
    }
    
    // Scroll to bottom
    scrollChatToBottom();
}

// Handle reaction optimistically (for local user)
function handleReactionOptimistically(messageId, emoji) {
    const peerId = state.myPeerId;
    if (!peerId) return;
    
    // Find message in state
    const msg = state.chatMessages.find(m => m.messageId === messageId);
    if (!msg) return;
    
    // Initialize reactions array if needed
    if (!msg.reactions) {
        msg.reactions = [];
    }
    
    // Add or update reaction
    const existingReaction = msg.reactions.find(r => r.emoji === emoji && r.peerId === peerId);
    if (existingReaction) {
        // Remove reaction if same user clicked same emoji
        const index = msg.reactions.indexOf(existingReaction);
        msg.reactions.splice(index, 1);
    } else {
        // Add new reaction
        msg.reactions.push({ emoji, peerId });
    }
    
    // Update UI immediately
    updateMessageReactions(msg);
}

// Handle chat reaction (from network)
export function handleChatReaction(message) {
    const { messageId, emoji, peerId } = message;
    
    // Find message in state
    const msg = state.chatMessages.find(m => m.messageId === messageId);
    if (!msg) return;
    
    // Skip if this is our own reaction (already handled optimistically)
    if (peerId === state.myPeerId) {
        // Just verify it matches - if not, update it
        const existingReaction = msg.reactions?.find(r => r.emoji === emoji && r.peerId === peerId);
        if (existingReaction) {
            // Already handled optimistically, skip
            return;
        }
    }
    
    // Initialize reactions array if needed
    if (!msg.reactions) {
        msg.reactions = [];
    }
    
    // Add or update reaction
    const existingReaction = msg.reactions.find(r => r.emoji === emoji && r.peerId === peerId);
    if (existingReaction) {
        // Remove reaction if same user clicked same emoji
        const index = msg.reactions.indexOf(existingReaction);
        msg.reactions.splice(index, 1);
    } else {
        // Add new reaction
        msg.reactions.push({ emoji, peerId });
    }
    
    // Update UI
    updateMessageReactions(msg);
}

// Add message to UI
function addMessageToUI(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageEl = createMessageElement(message);
    chatMessages.appendChild(messageEl);
    
    scrollChatToBottom();
}

// Create message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.isLocal ? 'chat-message-local' : 'chat-message-remote'}`;
    messageDiv.dataset.messageId = message.messageId;
    
    const isLocal = message.isLocal;
    
    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = `chat-message-content ${isLocal ? 'bg-blue-600' : 'bg-gray-700'} rounded-lg p-3`;
    
    // Sender name (only for remote messages)
    if (!isLocal) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'text-xs font-semibold text-gray-300 mb-1';
        nameDiv.textContent = getDisplayName(message.peerId);
        contentDiv.appendChild(nameDiv);
    }
    
    // File attachment
    if (message.file) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'mb-2';
        
        if (message.fileType && message.fileType.startsWith('image/')) {
            // Image preview
            const img = document.createElement('img');
            img.src = message.file.data;
            img.className = 'max-w-full max-h-48 rounded cursor-pointer';
            img.alt = message.fileName || 'Image';
            img.addEventListener('click', () => {
                // Open image in new tab
                const newWindow = window.open();
                if (newWindow) {
                    newWindow.document.write(`<img src="${message.file.data}" style="max-width:100%; height:auto;">`);
                }
            });
            fileDiv.appendChild(img);
        } else {
            // File download button
            const fileBtn = document.createElement('button');
            fileBtn.className = 'flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white transition-colors';
            fileBtn.innerHTML = `
                <i class="fas fa-download" style="font-size: 16px;"></i>
                <span>${message.fileName || 'Download file'}</span>
                <span class="text-xs text-gray-400">(${(message.file.size / 1024).toFixed(1)} KB)</span>
            `;
            fileBtn.addEventListener('click', () => {
                // Download file
                const link = document.createElement('a');
                link.href = message.file.data;
                link.download = message.fileName || 'file';
                link.click();
            });
            fileDiv.appendChild(fileBtn);
        }
        
        contentDiv.appendChild(fileDiv);
    }
    
    // Message text
    if (message.text) {
        const textDiv = document.createElement('div');
        textDiv.className = 'text-white text-sm whitespace-pre-wrap break-words';
        textDiv.textContent = message.text;
        contentDiv.appendChild(textDiv);
    }
    
    // Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-400 mt-1';
    timeDiv.textContent = formatTimestamp(message.timestamp);
    contentDiv.appendChild(timeDiv);
    
    // Reactions container
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'chat-message-reactions mt-2 flex flex-wrap gap-1';
    reactionsDiv.dataset.messageId = message.messageId;
    if (message.reactions && message.reactions.length > 0) {
        updateReactionsUI(reactionsDiv, message.reactions, message.messageId);
    }
    contentDiv.appendChild(reactionsDiv);
    
    // Reaction button
    const reactionBtn = document.createElement('button');
    reactionBtn.className = 'chat-reaction-btn text-xs text-gray-400 hover:text-gray-300 mt-1';
    reactionBtn.innerHTML = '<i class="fas fa-smile" style="font-size: 12px;"></i> Add reaction';
    reactionBtn.addEventListener('click', () => {
        showReactionPicker(message.messageId);
    });
    contentDiv.appendChild(reactionBtn);
    
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

// Update message reactions UI
function updateMessageReactions(message) {
    const messageEl = document.querySelector(`[data-message-id="${message.messageId}"]`);
    if (!messageEl) return;
    
    const reactionsDiv = messageEl.querySelector('.chat-message-reactions');
    if (!reactionsDiv) return;
    
    updateReactionsUI(reactionsDiv, message.reactions || [], message.messageId);
}

// Update reactions UI
function updateReactionsUI(reactionsDiv, reactions, messageId) {
    reactionsDiv.innerHTML = '';
    
    if (!reactions || reactions.length === 0) return;
    
    // Group reactions by emoji
    const grouped = {};
    reactions.forEach(r => {
        if (!grouped[r.emoji]) {
            grouped[r.emoji] = [];
        }
        grouped[r.emoji].push(r);
    });
    
    // Create reaction buttons
    Object.entries(grouped).forEach(([emoji, reactionList]) => {
        const reactionBtn = document.createElement('button');
        reactionBtn.className = 'chat-reaction-item px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded-full text-xs flex items-center gap-1 transition-colors';
        reactionBtn.innerHTML = `<span>${emoji}</span><span>${reactionList.length}</span>`;
        reactionBtn.title = `${emoji} (${reactionList.length})`;
        reactionBtn.addEventListener('click', () => {
            sendChatReaction(messageId, emoji);
        });
        reactionsDiv.appendChild(reactionBtn);
    });
}

// Show reaction picker
function showReactionPicker(messageId) {
    // Simple reaction picker with common emojis
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'absolute bg-gray-700 border border-gray-600 rounded-lg shadow-xl p-2 z-50';
    popup.style.display = 'flex';
    popup.style.gap = '4px';
    
    // Function to safely remove popup
    const removePopup = () => {
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
        document.removeEventListener('click', handleOutsideClick);
    };
    
    // Handle outside click
    const handleOutsideClick = (e) => {
        if (popup && popup.parentNode && !popup.contains(e.target)) {
            removePopup();
        }
    };
    
    quickReactions.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'p-2 hover:bg-gray-600 rounded text-lg';
        btn.textContent = emoji;
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering outside click
            sendChatReaction(messageId, emoji);
            // Optimistically update local UI
            handleReactionOptimistically(messageId, emoji);
            removePopup();
        });
        popup.appendChild(btn);
    });
    
    // Position popup
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        const rect = messageEl.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.top - 50}px`;
    }
    
    document.body.appendChild(popup);
    
    // Add outside click listener after a short delay to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
        return `${Math.floor(diff / 3600000)}h ago`;
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Scroll chat to bottom
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Update chat UI
export function updateChatUI() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    // Clear existing messages
    chatMessages.innerHTML = '';
    
    // Render all messages
    state.chatMessages.forEach(message => {
        const messageEl = createMessageElement(message);
        chatMessages.appendChild(messageEl);
    });
    
    scrollChatToBottom();
}

// Update unread badge
export function updateUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    if (!badge) return;
    
    if (state.unreadChatCount > 0) {
        badge.classList.remove('hidden');
        badge.textContent = state.unreadChatCount > 99 ? '99+' : state.unreadChatCount;
    } else {
        badge.classList.add('hidden');
    }
}

// Clear unread count
export function clearUnreadCount() {
    state.unreadChatCount = 0;
    updateUnreadBadge();
}

// Make functions available globally
window.initChat = initChat;
window.handleChatMessage = handleChatMessage;
window.handleChatReaction = handleChatReaction;
window.updateChatUI = updateChatUI;
window.clearUnreadCount = clearUnreadCount;

