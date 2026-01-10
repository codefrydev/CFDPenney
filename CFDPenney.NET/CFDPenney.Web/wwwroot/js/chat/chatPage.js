// Chat Page Main Module
import { initializeSignalR, startConnection, hostSession, joinSession, sendChatMessage as signalrSendChat, setCallbacks, isConnectionActive, connection } from '../collaboration/signalrClient.js';
import { handleTyping, stopTyping, resetTypingState } from './typingIndicator.js';
import { handleFileSelect, convertFileToBase64, updateFilePreview, downloadFile } from './fileUpload.js';

// State
let currentSessionCode = null;
let currentSession = null;
let myPeerId = null; // Store our peer ID
let conversations = new Map(); // Map<sessionCode, conversationData>
let chatMessages = new Map(); // Map<sessionCode, messages[]>
let typingUsers = new Set(); // Set of user IDs currently typing
let selectedFile = null;
let emojiPickerVisible = false;
let isInitialized = false; // Prevent multiple initializations

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

// Initialize chat page
export async function initChatPage() {
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('[ChatPage] Already initialized, skipping...');
        return;
    }
    
    console.log('[ChatPage] Initializing...');
    isInitialized = true;
    
    // Initialize SignalR
    initializeSignalR();
    
    // Set up SignalR callbacks
    setCallbacks({
        onChatMessage: handleIncomingMessage,
        onParticipantJoined: handleParticipantJoined,
        onParticipantLeft: handleParticipantLeft,
        onSessionJoined: handleSessionJoined,
        onTypingIndicator: handleTypingIndicator,
        onTypingStopped: handleTypingStopped
    });
    
    // Connect to SignalR
    try {
        await startConnection();
        console.log('[ChatPage] Connected to SignalR');
    } catch (err) {
        console.error('[ChatPage] Failed to connect:', err);
        alert('Failed to connect to chat server. Please refresh the page.');
        return;
    }
    
    // Set up UI event listeners
    setupEventListeners();
    
    // Set up emoji picker
    setupEmojiPicker();
    
    // Load conversations from URL or create new
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        await joinConversation(code);
    } else {
        // Show empty state
        updateConversationsList();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Chat input
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatFileBtn = document.getElementById('chat-file-btn');
    const chatFileInput = document.getElementById('chat-file-input');
    const chatFileRemove = document.getElementById('chat-file-remove');
    const chatEmojiBtn = document.getElementById('chat-emoji-btn');
    
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            autoResizeTextarea(chatInput);
            if (currentSessionCode) {
                handleTyping(chatInput, currentSessionCode);
            }
        });
        
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        chatInput.addEventListener('blur', () => {
            if (currentSessionCode) {
                stopTyping(currentSessionCode);
            }
        });
    }
    
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
    }
    
    if (chatFileBtn && chatFileInput) {
        chatFileBtn.addEventListener('click', () => chatFileInput.click());
        chatFileInput.addEventListener('change', (e) => {
            const file = handleFileSelect(chatFileInput, (file) => {
                selectedFile = file;
                updateFilePreview(
                    file,
                    document.getElementById('chat-file-preview'),
                    document.getElementById('chat-file-name'),
                    document.getElementById('chat-file-size'),
                    document.getElementById('chat-file-preview-img')
                );
            });
        });
    }
    
    if (chatFileRemove) {
        chatFileRemove.addEventListener('click', () => {
            selectedFile = null;
            if (chatFileInput) chatFileInput.value = '';
            updateFilePreview(
                null,
                document.getElementById('chat-file-preview'),
                document.getElementById('chat-file-name'),
                document.getElementById('chat-file-size'),
                document.getElementById('chat-file-preview-img')
            );
        });
    }
    
    if (chatEmojiBtn) {
        chatEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEmojiPicker();
        });
    }
    
    // New conversation button
    const newConversationBtn = document.getElementById('btn-new-conversation');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', createNewConversation);
    }
    
    // Details panel toggle
    const toggleDetailsBtn = document.getElementById('btn-toggle-details');
    const closeDetailsBtn = document.getElementById('btn-close-details');
    const detailsPanel = document.getElementById('chat-details-panel');
    
    if (toggleDetailsBtn) {
        toggleDetailsBtn.addEventListener('click', () => {
            if (detailsPanel) {
                detailsPanel.classList.toggle('hidden');
            }
        });
    }
    
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            if (detailsPanel) {
                detailsPanel.classList.add('hidden');
            }
        });
    }
    
    // Copy session code
    const copyCodeBtn = document.getElementById('btn-copy-session-code');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            if (currentSessionCode) {
                navigator.clipboard.writeText(currentSessionCode);
                // Show feedback
                const originalHTML = copyCodeBtn.innerHTML;
                copyCodeBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
                setTimeout(() => {
                    copyCodeBtn.innerHTML = originalHTML;
                    if (window.lucide) window.lucide.createIcons();
                }, 2000);
            }
        });
    }
    
    // Leave session
    const leaveSessionBtn = document.getElementById('btn-leave-session');
    if (leaveSessionBtn) {
        leaveSessionBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to leave this session?')) {
                leaveSession();
            }
        });
    }
    
    // Search conversations
    const searchInput = document.getElementById('conversations-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value);
        });
    }
    
    // Close emoji picker on outside click
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
    
    const emojiGrid = emojiPicker.querySelector('.chat-emoji-grid');
    if (!emojiGrid) return;
    
    COMMON_EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'chat-emoji-btn';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', () => {
            insertEmoji(emoji);
            hideEmojiPicker();
        });
        emojiGrid.appendChild(btn);
    });
}

function toggleEmojiPicker() {
    emojiPickerVisible = !emojiPickerVisible;
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    if (emojiPickerVisible) {
        emojiPicker.classList.remove('hidden');
    } else {
        emojiPicker.classList.add('hidden');
    }
}

function hideEmojiPicker() {
    emojiPickerVisible = false;
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) {
        emojiPicker.classList.add('hidden');
    }
}

function insertEmoji(emoji) {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const cursorPos = chatInput.selectionStart;
    const textBefore = chatInput.value.substring(0, cursorPos);
    const textAfter = chatInput.value.substring(cursorPos);
    chatInput.value = textBefore + emoji + textAfter;
    chatInput.selectionStart = chatInput.selectionEnd = cursorPos + emoji.length;
    chatInput.focus();
    autoResizeTextarea(chatInput);
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// Create new conversation
async function createNewConversation() {
    try {
        const code = await hostSession('board');
        await joinConversation(code);
    } catch (err) {
        console.error('[ChatPage] Failed to create conversation:', err);
        alert('Failed to create conversation. Please try again.');
    }
}

// Join conversation
async function joinConversation(code) {
    if (!code) return;
    
    try {
        const peerId = generatePeerId();
        myPeerId = peerId; // Store our peer ID
        const name = getUserName();
        const success = await joinSession(code, peerId, name);
        
        if (success) {
            currentSessionCode = code;
            updateURL(code);
            // Session data will be received via onSessionJoined callback
        } else {
            alert('Failed to join conversation. The session may not exist.');
        }
    } catch (err) {
        console.error('[ChatPage] Failed to join conversation:', err);
        alert('Failed to join conversation. Please try again.');
    }
}

// Handle session joined
function handleSessionJoined(data) {
    console.log('[ChatPage] Session joined:', data);
    
    currentSession = data;
    currentSessionCode = data.Code;
    
    // Store conversation
    conversations.set(data.Code, {
        code: data.Code,
        participants: data.Participants || [],
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date()
    });
    
    // Store chat history
    if (data.ChatHistory && data.ChatHistory.length > 0) {
        chatMessages.set(data.Code, data.ChatHistory.map(msg => ({
            ...msg,
            timestamp: new Date(msg.Timestamp || Date.now())
        })));
    } else {
        chatMessages.set(data.Code, []);
    }
    
    // Update UI
    updateConversationsList();
    displayMessages(data.Code);
    updateSessionInfo(data);
    updateParticipantsList(data.Participants || []);
}

// Send message
async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !currentSessionCode) return;
    
    const text = chatInput.value.trim();
    if (!text && !selectedFile) return;
    
    if (!isConnectionActive()) {
        alert('Not connected to chat server. Please wait...');
        return;
    }
    
    try {
        let fileData = null;
        
        if (selectedFile) {
            fileData = await convertFileToBase64(selectedFile);
        }
        
        // Create message - if there's a file, send as JSON string, otherwise send text
        let messageToSend;
        if (fileData) {
            const messageWithFile = {
                text: text || '',
                file: fileData,
                fileName: selectedFile.name,
                fileType: selectedFile.type
            };
            messageToSend = JSON.stringify(messageWithFile);
        } else {
            messageToSend = text;
        }
        
        // Send via SignalR
        await signalrSendChat(messageToSend, null);
        
        // Clear input
        const chatFileInput = document.getElementById('chat-file-input');
        chatInput.value = '';
        chatInput.style.height = 'auto';
        selectedFile = null;
        updateFilePreview(
            null,
            document.getElementById('chat-file-preview'),
            document.getElementById('chat-file-name'),
            document.getElementById('chat-file-size'),
            document.getElementById('chat-file-preview-img')
        );
        if (chatFileInput) chatFileInput.value = '';
        
        // Stop typing
        stopTyping(currentSessionCode);
    } catch (err) {
        console.error('[ChatPage] Failed to send message:', err);
        alert('Failed to send message. Please try again.');
    }
}

// Handle incoming message
function handleIncomingMessage(message) {
    console.log('[ChatPage] Received message:', message);
    
    const sessionCode = currentSessionCode; // Message is for current session
    if (!sessionCode) return;
    
    // Parse message content - it might be a JSON string with file data
    let messageText = message.Content || message.content || '';
    let messageData = { text: messageText };
    
    // Try to parse as JSON (for file attachments)
    if (typeof messageText === 'string' && messageText.startsWith('{')) {
        try {
            const parsed = JSON.parse(messageText);
            messageData = parsed;
            messageText = parsed.text || messageText;
        } catch (e) {
            // Not JSON, use as-is
        }
    }
    
    // Add to messages
    if (!chatMessages.has(sessionCode)) {
        chatMessages.set(sessionCode, []);
    }
    
    const messages = chatMessages.get(sessionCode);
    const chatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        peerId: message.PeerId || message.peerId || 'unknown',
        name: message.Name || message.name || 'Guest',
        text: messageText || '',
        file: messageData.file || null,
        fileName: messageData.fileName || null,
        fileType: messageData.fileType || null,
        timestamp: new Date(message.Timestamp || message.timestamp || Date.now()),
        reactions: []
    };
    
    messages.push(chatMessage);
    
    // Update conversation
    const conversation = conversations.get(sessionCode);
    if (conversation) {
        conversation.lastMessage = chatMessage;
        conversation.updatedAt = new Date();
        if (sessionCode !== currentSessionCode) {
            conversation.unreadCount++;
        }
    }
    
    // Display if current session
    if (sessionCode === currentSessionCode) {
        displayMessages(sessionCode);
        scrollToBottom();
    } else {
        updateConversationsList();
    }
}

// Display messages
function displayMessages(sessionCode) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messages = chatMessages.get(sessionCode) || [];
    
    // Clear container
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="chat-empty-messages"><i data-lucide="message-circle" class="w-16 h-16 text-gray-500 mb-4"></i><p class="text-gray-400 text-lg">No messages yet. Start the conversation!</p></div>';
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    // Group messages by date
    let currentDate = null;
    const myPeerId = getMyPeerId();
    
    messages.forEach((msg, index) => {
        const msgDate = new Date(msg.timestamp);
        const dateStr = formatDate(msgDate);
        
        // Add date divider if needed
        if (dateStr !== currentDate) {
            currentDate = dateStr;
            const divider = document.createElement('div');
            divider.className = 'chat-timestamp-divider';
            divider.textContent = dateStr;
            messagesContainer.appendChild(divider);
        }
        
        // Create message element
        const messageEl = createMessageElement(msg, myPeerId);
        messagesContainer.appendChild(messageEl);
    });
    
    // Re-initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    scrollToBottom();
}

// Create message element
function createMessageElement(message, myPeerId) {
    const isOwn = message.peerId === myPeerId;
    
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message-wrapper ${isOwn ? 'own' : ''}`;
    
    if (!isOwn) {
        const avatar = document.createElement('div');
        avatar.className = 'chat-message-avatar';
        avatar.textContent = getInitials(message.name);
        wrapper.appendChild(avatar);
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    
    if (!isOwn) {
        const sender = document.createElement('div');
        sender.className = 'chat-message-sender';
        sender.textContent = message.name;
        bubble.appendChild(sender);
    }
    
    // File attachment
    if (message.file) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'chat-message-file';
        
        if (message.fileType && message.fileType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = message.file.data || message.file;
            img.alt = message.fileName || 'Image';
            img.addEventListener('click', () => {
                const newWindow = window.open();
                if (newWindow) {
                    newWindow.document.write(`<img src="${img.src}" style="max-width:100%; height:auto;">`);
                }
            });
            fileDiv.appendChild(img);
        } else {
            const downloadBtn = document.createElement('div');
            downloadBtn.className = 'chat-message-file-download';
            downloadBtn.innerHTML = `
                <i data-lucide="download" class="w-4 h-4"></i>
                <span>${message.fileName || 'Download file'}</span>
                <span style="font-size: 11px; opacity: 0.7;">(${(message.file.size / 1024).toFixed(1)} KB)</span>
            `;
            downloadBtn.addEventListener('click', () => {
                downloadFile(message.file.data || message.file, message.fileName || 'file');
            });
            fileDiv.appendChild(downloadBtn);
        }
        
        bubble.appendChild(fileDiv);
    }
    
    // Message text
    if (message.text) {
        const text = document.createElement('div');
        text.className = 'chat-message-text';
        text.textContent = message.text;
        bubble.appendChild(text);
    }
    
    // Timestamp
    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.textContent = formatTime(message.timestamp);
    bubble.appendChild(time);
    
    wrapper.appendChild(bubble);
    return wrapper;
}

// Update conversations list
function updateConversationsList() {
    const list = document.getElementById('conversations-list');
    if (!list) return;
    
    if (conversations.size === 0) {
        list.innerHTML = `
            <div class="chat-empty-state">
                <i data-lucide="message-square" class="w-12 h-12 text-gray-500 mb-2"></i>
                <p class="text-gray-400 text-sm">No conversations yet</p>
                <p class="text-gray-500 text-xs mt-1">Start a collaboration session to begin chatting</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    list.innerHTML = '';
    
    // Sort conversations by updated time
    const sortedConversations = Array.from(conversations.values())
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    sortedConversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-conversation-item ${conv.code === currentSessionCode ? 'active' : ''}`;
        item.addEventListener('click', () => {
            joinConversation(conv.code);
        });
        
        const avatar = document.createElement('div');
        avatar.className = 'chat-conversation-avatar';
        avatar.textContent = getInitials(`Session ${conv.code}`);
        
        const content = document.createElement('div');
        content.className = 'chat-conversation-content';
        
        const name = document.createElement('div');
        name.className = 'chat-conversation-name';
        name.textContent = `Session ${conv.code}`;
        
        const preview = document.createElement('div');
        preview.className = 'chat-conversation-preview';
        preview.textContent = conv.lastMessage ? (conv.lastMessage.text || 'File attachment') : 'No messages yet';
        
        content.appendChild(name);
        content.appendChild(preview);
        
        const meta = document.createElement('div');
        meta.className = 'chat-conversation-meta';
        
        if (conv.lastMessage) {
            const time = document.createElement('div');
            time.className = 'chat-conversation-time';
            time.textContent = formatTime(conv.lastMessage.timestamp);
            meta.appendChild(time);
        }
        
        if (conv.unreadCount > 0 && conv.code !== currentSessionCode) {
            const unread = document.createElement('div');
            unread.className = 'chat-conversation-unread';
            unread.textContent = conv.unreadCount > 99 ? '99+' : conv.unreadCount;
            meta.appendChild(unread);
        }
        
        item.appendChild(avatar);
        item.appendChild(content);
        item.appendChild(meta);
        
        list.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

// Update session info
function updateSessionInfo(session) {
    const title = document.getElementById('chat-session-title');
    const subtitle = document.getElementById('chat-session-subtitle');
    const codeEl = document.getElementById('chat-details-code');
    const createdEl = document.getElementById('chat-details-created');
    const participantCountEl = document.getElementById('chat-details-participant-count');
    
    if (title) title.textContent = `Session ${session.Code}`;
    if (subtitle) subtitle.textContent = `${session.Participants?.length || 0} participants`;
    if (codeEl) codeEl.textContent = session.Code;
    if (createdEl) createdEl.textContent = formatDate(new Date());
    if (participantCountEl) participantCountEl.textContent = session.Participants?.length || 0;
}

// Update participants list
function updateParticipantsList(participants) {
    const list = document.getElementById('chat-details-participants-list');
    if (!list) return;
    
    if (!participants || participants.length === 0) {
        list.innerHTML = '<p class="chat-empty-text">No participants</p>';
        return;
    }
    
    list.innerHTML = '';
    participants.forEach(participant => {
        const item = document.createElement('div');
        item.className = 'chat-participant-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'chat-participant-avatar';
        avatar.textContent = getInitials(participant.Name || participant.name || 'Guest');
        
        const name = document.createElement('div');
        name.className = 'chat-participant-name';
        name.textContent = participant.Name || participant.name || 'Guest';
        
        item.appendChild(avatar);
        item.appendChild(name);
        list.appendChild(item);
    });
}

// Handle participant joined
function handleParticipantJoined(participant) {
    if (currentSession && currentSession.Participants) {
        if (!currentSession.Participants.find(p => p.ConnectionId === participant.ConnectionId)) {
            currentSession.Participants.push(participant);
        }
        updateParticipantsList(currentSession.Participants);
        updateSessionInfo(currentSession);
    }
}

// Handle participant left
function handleParticipantLeft(data) {
    if (currentSession && currentSession.Participants) {
        currentSession.Participants = currentSession.Participants.filter(
            p => p.ConnectionId !== data.ConnectionId
        );
        updateParticipantsList(currentSession.Participants);
        updateSessionInfo(currentSession);
    }
}

// Typing indicator functions
export async function sendTypingIndicator(sessionCode) {
    if (!sessionCode) return;
    try {
        await startConnection();
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("SendTypingIndicator", sessionCode);
        }
    } catch (err) {
        console.error('[ChatPage] Failed to send typing indicator:', err);
    }
}

export async function clearTypingIndicator(sessionCode) {
    if (!sessionCode) return;
    try {
        await startConnection();
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("ClearTypingIndicator", sessionCode);
        }
    } catch (err) {
        console.error('[ChatPage] Failed to clear typing indicator:', err);
    }
}

function handleTypingIndicator(data) {
    const { peerId, name } = data;
    if (peerId === getMyPeerId()) return; // Don't show our own typing
    
    typingUsers.add(peerId);
    updateTypingIndicator();
}

function handleTypingStopped(data) {
    const { peerId } = data;
    typingUsers.delete(peerId);
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const indicator = document.getElementById('chat-typing-indicator');
    const text = document.getElementById('chat-typing-text');
    
    if (!indicator || !text) return;
    
    if (typingUsers.size > 0) {
        const names = Array.from(typingUsers).map(id => {
            // Try to get name from current session
            if (currentSession && currentSession.Participants) {
                const participant = currentSession.Participants.find(p => p.PeerId === id);
                return participant?.Name || participant?.name || 'Someone';
            }
            return 'Someone';
        });
        
        if (names.length === 1) {
            text.textContent = `${names[0]} is typing...`;
        } else if (names.length === 2) {
            text.textContent = `${names[0]} and ${names[1]} are typing...`;
        } else {
            text.textContent = `${names[0]} and ${names.length - 1} others are typing...`;
        }
        
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Utility functions
function generatePeerId() {
    return 'peer_' + Math.random().toString(36).substr(2, 9);
}

function getUserName() {
    // Try to get from user context or use default
    return 'Guest';
}

function getMyPeerId() {
    // Return stored peer ID
    return myPeerId;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function updateURL(code) {
    const url = new URL(window.location);
    url.searchParams.set('code', code);
    window.history.pushState({}, '', url);
}

function filterConversations(query) {
    const items = document.querySelectorAll('.chat-conversation-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
        const name = item.querySelector('.chat-conversation-name')?.textContent || '';
        const preview = item.querySelector('.chat-conversation-preview')?.textContent || '';
        const matches = name.toLowerCase().includes(lowerQuery) || preview.toLowerCase().includes(lowerQuery);
        item.style.display = matches ? '' : 'none';
    });
}

function leaveSession() {
    currentSessionCode = null;
    currentSession = null;
    resetTypingState();
    
    // Clear UI
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="chat-empty-messages"><i data-lucide="message-circle" class="w-16 h-16 text-gray-500 mb-4"></i><p class="text-gray-400 text-lg">Select a conversation to start messaging</p></div>';
    }
    
    const title = document.getElementById('chat-session-title');
    const subtitle = document.getElementById('chat-session-subtitle');
    if (title) title.textContent = 'Select a conversation';
    if (subtitle) subtitle.textContent = '';
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.delete('code');
    window.history.pushState({}, '', url);
    
    if (window.lucide) window.lucide.createIcons();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatPage);
} else {
    initChatPage();
}
