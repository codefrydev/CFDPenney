// Chat Page - Minimal JavaScript, all rendering done via Razor/C#
// Only handles SignalR real-time updates and basic UI interactions

let chatConnection = null;
let currentConversationId = window.selectedConversationId || null;

// Initialize
async function initChatPage() {
    if (!window.currentUserId) {
        alert('Please sign in to use chat.');
        return;
    }
    
    try {
        chatConnection = new signalR.HubConnectionBuilder()
            .withUrl("/chatHub", {
                skipNegotiation: false,
                transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
            })
            .withAutomaticReconnect()
            .build();
        
        setupSignalRHandlers();
        await chatConnection.start();
        console.log('[ChatPage] Connected to ChatHub');
        
        // Wait a bit for DOM to be fully ready
        setTimeout(() => {
            setupEventListeners();
        }, 100);
    } catch (err) {
        console.error('[ChatPage] Connection failed:', err);
        alert('Failed to connect to chat server. Please refresh the page.');
    }
}

function setupSignalRHandlers() {
    // Server sends updated conversations list - update UI dynamically
    chatConnection.on("ConversationsLoaded", (conversations) => {
        // Update conversations list in DOM without reloading
        updateConversationsList(conversations);
    });
    
    // Conversation joined - server sends data, update UI
    chatConnection.on("ConversationJoined", (data) => {
        console.log('[ChatPage] ConversationJoined event received:', data);
        const conversation = data?.conversation || data?.Conversation;
        if (!data || !conversation) {
            console.error('[ChatPage] Invalid ConversationJoined data:', data);
            return;
        }
        
        const convId = conversation.id || conversation.Id;
        currentConversationId = convId;
        console.log('[ChatPage] Updating UI for conversation:', currentConversationId);
        
        // Update messages in DOM without reloading
        const messages = data.messages || data.Messages;
        if (messages && Array.isArray(messages)) {
            console.log('[ChatPage] Loading', messages.length, 'messages');
            updateMessagesList(messages);
        } else {
            console.log('[ChatPage] No messages in response, clearing messages');
            updateMessagesList([]);
        }
        
        // Update conversation header
        updateConversationHeader(conversation);
        
        // Show input area if it was hidden
        const inputArea = document.getElementById('chat-input-area');
        if (inputArea) {
            inputArea.style.display = '';
            // Focus on input after a short delay
            setTimeout(() => {
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.focus();
                }
            }, 100);
        } else {
            console.warn('[ChatPage] chat-input-area not found');
        }
        
        console.log('[ChatPage] Conversation UI updated successfully');
    });
    
    // Message received - append to DOM (server sends complete message)
    chatConnection.on("MessageReceived", (message) => {
        const convId = message.conversationId || message.ConversationId;
        if (convId === currentConversationId) {
            appendMessage(message);
            scrollToBottom();
        }
    });
    
    // Message edited - update in DOM
    chatConnection.on("MessageEdited", (data) => {
        const messageId = data.id || data.Id;
        const content = data.content || data.Content;
        const editedAt = data.editedAt || data.EditedAt;
        updateMessageInUI(messageId, content, editedAt);
    });
    
    // Message deleted - remove from DOM
    chatConnection.on("MessageDeleted", (messageId) => {
        document.querySelector(`[data-message-id="${messageId}"]`)?.remove();
    });
    
    // Reactions updated
    chatConnection.on("ReactionAdded", (data) => {
        const messageId = data.messageId || data.MessageId;
        const reactions = data.reactions || data.Reactions;
        updateMessageReactions(messageId, reactions);
    });
    
    chatConnection.on("ReactionRemoved", (data) => {
        const messageId = data.messageId || data.MessageId;
        const reactions = data.reactions || data.Reactions;
        updateMessageReactions(messageId, reactions);
    });
    
    // Read receipts
    chatConnection.on("MessageRead", (data) => {
        const messageId = data.messageId || data.MessageId;
        const readBy = data.readBy || data.ReadBy;
        updateReadReceipts(messageId, readBy);
    });
    
    // Presence updates
    chatConnection.on("UserPresenceChanged", (data) => {
        updatePresenceIndicator(data.UserId, data.Status);
    });
    
    // Call events
    chatConnection.on("CallStarted", (data) => {
        showIncomingCall(data);
    });
    
    chatConnection.on("CallAnswered", (data) => {
        showActiveCall(data);
    });
    
    chatConnection.on("CallRejected", (data) => {
        hideIncomingCall();
    });
    
    chatConnection.on("CallEnded", (data) => {
        hideCallUI();
    });
    
    chatConnection.on("CallParticipantUpdated", (data) => {
        updateCallParticipant(data);
    });
}

function setupEventListeners() {
    console.log('[ChatPage] Setting up event listeners...');
    
    // New conversation - show modal (server will handle creation)
    const btnNewConv = document.getElementById('btn-new-conversation');
    const btnNewGroup = document.getElementById('btn-new-group');
    
    if (btnNewConv) {
        btnNewConv.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] New conversation button clicked');
            showNewChatModal();
        });
        console.log('[ChatPage] New conversation button listener attached');
    } else {
        console.warn('[ChatPage] btn-new-conversation not found');
    }
    
    if (btnNewGroup) {
        btnNewGroup.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] New group button clicked');
            showNewGroupModal();
        });
        console.log('[ChatPage] New group button listener attached');
    } else {
        console.warn('[ChatPage] btn-new-group not found');
    }
    
    // Call buttons
    const btnVideoCall = document.getElementById('btn-start-video-call');
    const btnAudioCall = document.getElementById('btn-start-audio-call');
    
    if (btnVideoCall) {
        btnVideoCall.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Video call button clicked');
            const callType = parseInt(this.dataset.callType || '2');
            if (currentConversationId && chatConnection) {
                chatConnection.invoke("StartCall", currentConversationId, callType).catch(err => {
                    console.error('[ChatPage] Failed to start video call:', err);
                });
            }
        });
        console.log('[ChatPage] Video call button listener attached');
    }
    
    if (btnAudioCall) {
        btnAudioCall.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Audio call button clicked');
            const callType = parseInt(this.dataset.callType || '1');
            if (currentConversationId && chatConnection) {
                chatConnection.invoke("StartCall", currentConversationId, callType).catch(err => {
                    console.error('[ChatPage] Failed to start audio call:', err);
                });
            }
        });
        console.log('[ChatPage] Audio call button listener attached');
    }
    
    // Search (client-side filtering only)
    const searchInput = document.getElementById('conversations-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversationsUI(e.target.value);
        });
        console.log('[ChatPage] Search input listener attached');
    }
    
    // Details panel
    const btnToggleDetails = document.getElementById('btn-toggle-details');
    const btnCloseDetails = document.getElementById('btn-close-details');
    
    if (btnToggleDetails) {
        btnToggleDetails.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Toggle details button clicked');
            const panel = document.getElementById('chat-details-panel');
            if (panel) panel.classList.toggle('hidden');
        });
        console.log('[ChatPage] Toggle details button listener attached');
    }
    
    if (btnCloseDetails) {
        btnCloseDetails.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Close details button clicked');
            const panel = document.getElementById('chat-details-panel');
            if (panel) panel.classList.add('hidden');
        });
        console.log('[ChatPage] Close details button listener attached');
    }
    
    // Chat input
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        chatInput.addEventListener('input', () => {
            autoResizeTextarea(chatInput);
        });
    }
    
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Send button clicked');
            sendMessage();
        });
        console.log('[ChatPage] Send button listener attached');
    } else {
        console.warn('[ChatPage] chat-send-btn not found');
    }
    
    // File attachment
    const fileBtn = document.getElementById('chat-file-btn');
    const fileInput = document.getElementById('chat-file-input');
    const fileRemove = document.getElementById('chat-file-remove');
    
    if (fileBtn) {
        fileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] File button clicked');
            if (fileInput) fileInput.click();
        });
        console.log('[ChatPage] File button listener attached');
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (fileRemove) {
        fileRemove.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectedFile = null;
            updateFilePreview();
        });
    }
    
    // Emoji picker
    const emojiBtn = document.getElementById('chat-emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Emoji button clicked');
            emojiPicker.classList.toggle('hidden');
        });
        console.log('[ChatPage] Emoji button listener attached');
        
        // Close emoji picker when clicking outside
        document.addEventListener('click', (e) => {
            if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
                emojiPicker.classList.add('hidden');
            }
        });
    }
    
    // Emoji buttons in picker (already in DOM from Razor)
    document.querySelectorAll('.chat-emoji-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const emoji = this.dataset.emoji;
            if (emoji) {
                insertEmoji(emoji);
                if (emojiPicker) emojiPicker.classList.add('hidden');
            }
        });
    });
    
    console.log('[ChatPage] All event listeners setup complete');
}

let selectedFile = null;

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput || !currentConversationId) return;
    
    const text = chatInput.value.trim();
    if (!text && !selectedFile) return;
    
    try {
        let fileData = null;
        let fileName = null;
        let fileType = null;
        
        if (selectedFile) {
            fileData = await convertFileToBase64(selectedFile);
            fileName = selectedFile.name;
            fileType = selectedFile.type;
        }
        
        await chatConnection.invoke("SendMessage", currentConversationId, text, fileData, fileName, fileType);
        
        chatInput.value = '';
        chatInput.style.height = 'auto';
        selectedFile = null;
        updateFilePreview();
    } catch (err) {
        console.error('Failed to send message:', err);
        alert('Failed to send message. Please try again.');
    }
}

function appendMessage(message) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    // Handle both lowercase and uppercase property names
    const messageId = message.id || message.Id;
    const senderId = message.senderId || message.SenderId;
    const senderName = message.senderName || message.SenderName;
    const content = message.content || message.Content;
    const timestamp = message.timestamp || message.Timestamp;
    const file = message.file || message.File;
    
    // Create message element using same structure as Razor partial
    const wrapper = document.createElement('div');
    const isOwn = senderId === window.currentUserId;
    wrapper.className = `chat-message-wrapper ${isOwn ? 'own' : ''}`;
    wrapper.dataset.messageId = messageId;
    
    if (!isOwn) {
        const avatar = document.createElement('div');
        avatar.className = 'chat-message-avatar';
        avatar.textContent = getInitials(senderName || 'Unknown');
        wrapper.appendChild(avatar);
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    
    if (!isOwn) {
        const sender = document.createElement('div');
        sender.className = 'chat-message-sender';
        sender.textContent = senderName || 'Unknown';
        bubble.appendChild(sender);
    }
    
    if (file) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'chat-message-file';
        const fileType = file.type || file.Type;
        const fileData = file.data || file.Data;
        const fileName = file.name || file.Name;
        
        if (fileType && fileType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileData;
            img.alt = fileName;
            img.className = 'chat-message-image';
            img.onclick = () => window.open(fileData, '_blank');
            fileDiv.appendChild(img);
        } else {
            const downloadBtn = document.createElement('div');
            downloadBtn.className = 'chat-message-file-download';
            downloadBtn.innerHTML = `<i data-lucide="download" class="w-4 h-4"></i><span>${fileName}</span>`;
            downloadBtn.onclick = () => downloadFile(fileData, fileName);
            fileDiv.appendChild(downloadBtn);
        }
        bubble.appendChild(fileDiv);
    }
    
    if (content) {
        const text = document.createElement('div');
        text.className = 'chat-message-text';
        text.textContent = content;
        bubble.appendChild(text);
    }
    
    const footer = document.createElement('div');
    footer.className = 'chat-message-footer';
    const time = document.createElement('div');
    time.className = 'chat-message-time';
    try {
        time.textContent = formatTime(new Date(timestamp));
    } catch (e) {
        console.error('[ChatPage] Invalid timestamp:', timestamp, e);
        time.textContent = 'Invalid Date';
    }
    footer.appendChild(time);
    bubble.appendChild(footer);
    
    const reactionBtn = document.createElement('button');
    reactionBtn.className = 'chat-reaction-btn';
    reactionBtn.innerHTML = '<i data-lucide="smile" class="w-3 h-3"></i>';
    reactionBtn.onclick = () => showReactionPicker(messageId);
    bubble.appendChild(reactionBtn);
    
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    
    if (window.lucide) window.lucide.createIcons();
}

function updateMessageInUI(messageId, content, editedAt) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const textEl = messageEl.querySelector('.chat-message-text');
    if (textEl) textEl.textContent = content;
    
    if (editedAt && !messageEl.querySelector('.chat-message-edited')) {
        const edited = document.createElement('div');
        edited.className = 'chat-message-edited';
        edited.textContent = 'Edited';
        messageEl.querySelector('.chat-message-text')?.after(edited);
    }
}

function updateMessageReactions(messageId, reactions) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    let reactionsDiv = messageEl.querySelector('.chat-message-reactions');
    if (!reactionsDiv) {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'chat-message-reactions';
        messageEl.querySelector('.chat-message-bubble')?.appendChild(reactionsDiv);
    }
    
    reactionsDiv.innerHTML = '';
    if (!reactions || reactions.length === 0) return;
    
    const grouped = {};
    reactions.forEach(r => {
        if (!grouped[r.Emoji]) grouped[r.Emoji] = [];
        grouped[r.Emoji].push(r);
    });
    
    Object.entries(grouped).forEach(([emoji, list]) => {
        const btn = document.createElement('button');
        btn.className = 'chat-reaction-item';
        btn.innerHTML = `<span>${emoji}</span><span>${list.length}</span>`;
        btn.onclick = () => chatConnection.invoke("AddReaction", messageId, emoji);
        reactionsDiv.appendChild(btn);
    });
}

function updateReadReceipts(messageId, readBy) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl || !messageEl.classList.contains('own')) return;
    
    const footer = messageEl.querySelector('.chat-message-footer');
    if (!footer) return;
    
    if (readBy && readBy.length > 1) {
        if (!footer.querySelector('.chat-message-read')) {
            const read = document.createElement('div');
            read.className = 'chat-message-read';
            read.innerHTML = '<i data-lucide="check-check" class="w-4 h-4"></i>';
            footer.appendChild(read);
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

function updatePresenceIndicator(userId, status) {
    // Update presence dots in conversation list
    document.querySelectorAll('.chat-conversation-item').forEach(item => {
        const presenceDot = item.querySelector('.chat-presence-dot');
        if (presenceDot) {
            presenceDot.className = `chat-presence-dot ${status === 1 ? 'online' : 'offline'}`;
        }
    });
}

function showReactionPicker(messageId) {
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
    const popup = document.createElement('div');
    popup.className = 'chat-reaction-picker';
    
    quickReactions.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'chat-reaction-picker-btn';
        btn.textContent = emoji;
        btn.onclick = () => {
            chatConnection.invoke("AddReaction", messageId, emoji);
            popup.remove();
        };
        popup.appendChild(btn);
    });
    
    document.body.appendChild(popup);
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        const rect = messageEl.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.top - 50}px`;
    }
    
    setTimeout(() => {
        document.addEventListener('click', function removePopup(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', removePopup);
            }
        });
    }, 100);
}

function showIncomingCall(callData) {
    const overlay = document.createElement('div');
    overlay.id = 'incoming-call-overlay';
    overlay.className = 'call-overlay';
    
    const incomingDiv = document.createElement('div');
    incomingDiv.className = 'call-incoming';
    
    const avatar = document.createElement('div');
    avatar.className = 'call-incoming-avatar';
    avatar.textContent = getInitials(callData.CallerId);
    
    const info = document.createElement('div');
    info.className = 'call-incoming-info';
    const h3 = document.createElement('h3');
    h3.textContent = `Incoming ${callData.Type === 2 ? 'Video' : 'Audio'} Call`;
    info.appendChild(h3);
    
    const actions = document.createElement('div');
    actions.className = 'call-incoming-actions';
    
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'call-button accept';
    acceptBtn.innerHTML = '<i data-lucide="phone" class="w-6 h-6"></i>';
    acceptBtn.addEventListener('click', () => answerCall(callData.Id));
    
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'call-button reject';
    rejectBtn.innerHTML = '<i data-lucide="phone-off" class="w-6 h-6"></i>';
    rejectBtn.addEventListener('click', () => rejectCall(callData.Id));
    
    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    
    incomingDiv.appendChild(avatar);
    incomingDiv.appendChild(info);
    incomingDiv.appendChild(actions);
    overlay.appendChild(incomingDiv);
    document.body.appendChild(overlay);
    
    if (window.lucide) window.lucide.createIcons();
}

function showActiveCall(callData) {
    console.log('Show active call:', callData);
}

function hideIncomingCall() {
    document.getElementById('incoming-call-overlay')?.remove();
}

function hideCallUI() {
    document.getElementById('active-call-overlay')?.remove();
}

function updateCallParticipant(data) {
    console.log('Update call participant:', data);
}

// Update conversations list in DOM
function updateConversationsList(conversations) {
    console.log('[ChatPage] updateConversationsList called with', conversations?.length || 0, 'conversations');
    console.log('[ChatPage] Conversations data:', JSON.stringify(conversations, null, 2));
    const listContainer = document.getElementById('conversations-list');
    if (!listContainer) {
        console.error('[ChatPage] conversations-list container not found');
        return;
    }
    
    listContainer.innerHTML = '';
    
    if (!conversations || conversations.length === 0) {
        listContainer.innerHTML = `
            <div class="chat-empty-state">
                <i data-lucide="message-square" class="w-12 h-12 text-gray-500 mb-2"></i>
                <p class="text-gray-400 text-sm">No conversations yet</p>
                <p class="text-gray-500 text-xs mt-1">Start a new chat or group to begin messaging</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    // Filter out conversations without IDs and log them (server sends lowercase 'id')
    const validConversations = conversations.filter(conv => {
        if (!conv) {
            console.warn('[ChatPage] Null conversation object');
            return false;
        }
        const id = conv.id || conv.Id;
        if (!id) {
            console.warn('[ChatPage] Conversation missing ID:', conv);
            return false;
        }
        return true;
    });
    
    if (validConversations.length === 0) {
        console.error('[ChatPage] No valid conversations found after filtering');
        listContainer.innerHTML = `
            <div class="chat-empty-state">
                <i data-lucide="message-square" class="w-12 h-12 text-gray-500 mb-2"></i>
                <p class="text-gray-400 text-sm">No conversations yet</p>
                <p class="text-gray-500 text-xs mt-1">Start a new chat or group to begin messaging</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    console.log('[ChatPage] Valid conversations:', validConversations.length);
    
    // Sort conversations by last message time
    const sorted = [...validConversations].sort((a, b) => {
        const timeA = (a.lastMessageAt || a.LastMessageAt) ? new Date(a.lastMessageAt || a.LastMessageAt) : new Date(a.updatedAt || a.UpdatedAt || 0);
        const timeB = (b.lastMessageAt || b.LastMessageAt) ? new Date(b.lastMessageAt || b.LastMessageAt) : new Date(b.updatedAt || b.UpdatedAt || 0);
        return timeB - timeA;
    });
    
    sorted.forEach(conv => {
        // Validate conversation has an ID (server sends lowercase 'id')
        const conversationId = conv.id || conv.Id; // Support both cases
        if (!conv || !conversationId) {
            console.error('[ChatPage] Invalid conversation object:', conv);
            return;
        }
        
        const isActive = conversationId === currentConversationId;
        const item = document.createElement('div');
        item.className = `chat-conversation-item ${isActive ? 'active' : ''}`;
        item.dataset.conversationId = conversationId;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[ChatPage] Conversation item clicked, ID:', conversationId);
            selectConversation(conversationId);
        });
        
        const convType = conv.type || conv.Type || 1;
        const otherParticipant = convType === 1 && conv.participants 
            ? conv.participants.find(p => (p.userId || p.UserId) !== window.currentUserId)
            : convType === 1 && conv.Participants
            ? conv.Participants.find(p => (p.userId || p.UserId) !== window.currentUserId)
            : null;
        const otherUser = otherParticipant?.user || otherParticipant?.User;
        const displayName = convType === 1 && otherUser 
            ? (otherUser.displayName || otherUser.DisplayName || otherUser.username || otherUser.Username)
            : conv.name || conv.Name;
        
        const avatar = document.createElement('div');
        avatar.className = 'chat-conversation-avatar';
        const otherUserId = otherUser?.id || otherUser?.Id;
        avatar.style.backgroundColor = otherUserId ? getAvatarColor(otherUserId.toString()) : '#007AFF';
        avatar.textContent = displayName ? displayName.substring(0, 2).toUpperCase() : '?';
        
        const presence = otherParticipant?.presence || otherParticipant?.Presence;
        const presenceStatus = presence?.status || presence?.Status;
        if (presenceStatus === 1) {
            const dot = document.createElement('div');
            dot.className = 'chat-presence-dot online';
            avatar.appendChild(dot);
        }
        
        const content = document.createElement('div');
        content.className = 'chat-conversation-content';
        
        const name = document.createElement('div');
        name.className = 'chat-conversation-name';
        name.textContent = displayName || 'Unknown';
        
        const preview = document.createElement('div');
        preview.className = 'chat-conversation-preview';
        const lastMessage = conv.lastMessage || conv.LastMessage;
        if (lastMessage) {
            const file = lastMessage.file || lastMessage.File;
            if (file) {
                const fileName = file.name || file.Name;
                preview.textContent = `📎 ${fileName}`;
            } else {
                const text = lastMessage.content || lastMessage.Content || '';
                preview.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
            }
        } else {
            preview.textContent = 'No messages yet';
        }
        
        content.appendChild(name);
        content.appendChild(preview);
        
        const meta = document.createElement('div');
        meta.className = 'chat-conversation-meta';
        
        const lastMessageAt = conv.lastMessageAt || conv.LastMessageAt;
        if (lastMessageAt) {
            const time = document.createElement('div');
            time.className = 'chat-conversation-time';
            time.textContent = formatTime(new Date(lastMessageAt));
            meta.appendChild(time);
        }
        
        const unreadCount = conv.unreadCount || conv.UnreadCount || 0;
        if (unreadCount > 0 && !isActive) {
            const unread = document.createElement('div');
            unread.className = 'chat-conversation-unread';
            unread.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
            meta.appendChild(unread);
        }
        
        item.appendChild(avatar);
        item.appendChild(content);
        item.appendChild(meta);
        listContainer.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

// Update messages list in DOM
function updateMessagesList(messages) {
    console.log('[ChatPage] updateMessagesList called with', messages?.length || 0, 'messages');
    const container = document.getElementById('chat-messages');
    if (!container) {
        console.error('[ChatPage] chat-messages container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        console.log('[ChatPage] No messages, showing empty state');
        container.innerHTML = `
            <div class="chat-empty-messages">
                <i data-lucide="message-circle" class="w-16 h-16 text-gray-500 mb-4"></i>
                <p class="text-gray-400 text-lg">No messages yet. Start the conversation!</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    console.log('[ChatPage] Rendering', messages.length, 'messages');
    let currentDate = null;
    messages.forEach(message => {
        const timestamp = message.timestamp || message.Timestamp;
        const msgDate = formatDate(new Date(timestamp));
        if (msgDate !== currentDate) {
            currentDate = msgDate;
            const divider = document.createElement('div');
            divider.className = 'chat-timestamp-divider';
            divider.textContent = msgDate;
            container.appendChild(divider);
        }
        appendMessage(message);
    });
    
    scrollToBottom();
    if (window.lucide) window.lucide.createIcons();
}

// Update conversation header
function updateConversationHeader(conversation) {
    console.log('[ChatPage] updateConversationHeader called for:', conversation);
    
    // Get conversation name - for personal conversations, use the other participant's name
    const convType = conversation?.type || conversation?.Type || 1;
    const convName = conversation?.name || conversation?.Name;
    const participants = conversation?.participants || conversation?.Participants || [];
    
    let displayName = convName || 'Unknown';
    
    // For personal conversations, get the other participant's name
    if (convType === 1 && participants.length > 0) {
        const otherParticipant = participants.find(p => {
            const userId = p.userId || p.UserId;
            return userId !== window.currentUserId;
        });
        if (otherParticipant) {
            const otherUser = otherParticipant.user || otherParticipant.User;
            if (otherUser) {
                displayName = otherUser.displayName || otherUser.DisplayName || otherUser.username || otherUser.Username || displayName;
            }
        }
    }
    
    console.log('[ChatPage] Display name determined:', displayName);
    
    const title = document.getElementById('chat-session-title');
    const subtitle = document.getElementById('chat-session-subtitle');
    
    if (title) {
        title.textContent = displayName;
        console.log('[ChatPage] Updated conversation title to:', title.textContent);
    } else {
        console.warn('[ChatPage] chat-session-title not found');
    }
    
    if (subtitle) {
        const count = participants.length;
        subtitle.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
        console.log('[ChatPage] Updated conversation subtitle to:', subtitle.textContent);
    } else {
        console.warn('[ChatPage] chat-session-subtitle not found');
    }
    
    // Show input area
    const inputArea = document.getElementById('chat-input-area');
    if (inputArea) {
        inputArea.style.display = '';
        console.log('[ChatPage] Input area shown');
    } else {
        console.warn('[ChatPage] chat-input-area not found');
    }
    
    // Update details panel
    updateDetailsPanel(conversation);
    
    // Show call buttons if conversation is selected
    const videoCallBtn = document.getElementById('btn-start-video-call');
    const audioCallBtn = document.getElementById('btn-start-audio-call');
    if (videoCallBtn) videoCallBtn.style.display = '';
    if (audioCallBtn) audioCallBtn.style.display = '';
}

// Update details panel with conversation information
function updateDetailsPanel(conversation) {
    console.log('[ChatPage] updateDetailsPanel called with:', conversation);
    const detailsPanel = document.getElementById('chat-details-panel');
    if (!detailsPanel) {
        console.warn('[ChatPage] chat-details-panel not found');
        return;
    }
    
    detailsPanel.classList.remove('hidden');
    
    // Get conversation info
    const convName = conversation?.name || conversation?.Name || 'Unknown';
    const convType = conversation?.type || conversation?.Type || 1;
    const participants = conversation?.participants || conversation?.Participants || [];
    const createdAt = conversation?.createdAt || conversation?.CreatedAt;
    
    // For personal conversations, get the other participant's name
    let displayName = convName;
    if (convType === 1 && participants.length > 0) {
        const otherParticipant = participants.find(p => {
            const userId = p.userId || p.UserId;
            return userId !== window.currentUserId;
        });
        if (otherParticipant) {
            const otherUser = otherParticipant.user || otherParticipant.User;
            if (otherUser) {
                displayName = otherUser.displayName || otherUser.DisplayName || otherUser.username || otherUser.Username || displayName;
            }
        }
    }
    
    // Update conversation info section
    const sessionDetails = document.getElementById('chat-session-details');
    if (sessionDetails) {
        // Update name - find all detail items and update them
        const detailItems = sessionDetails.querySelectorAll('.chat-details-item');
        if (detailItems.length >= 1) {
            const nameValue = detailItems[0].querySelector('.chat-details-value');
            if (nameValue) nameValue.textContent = displayName;
        }
        
        if (detailItems.length >= 2) {
            const typeValue = detailItems[1].querySelector('.chat-details-value');
            if (typeValue) typeValue.textContent = convType === 1 ? 'Personal' : 'Group';
        }
        
        if (detailItems.length >= 3) {
            const createdValue = detailItems[2].querySelector('.chat-details-value');
            if (createdValue) {
                if (createdAt) {
                    try {
                        const date = new Date(createdAt);
                        createdValue.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } catch (e) {
                        console.error('[ChatPage] Error formatting date:', e);
                        createdValue.textContent = 'Unknown';
                    }
                } else {
                    createdValue.textContent = 'Unknown';
                }
            }
        }
        
        if (detailItems.length >= 4) {
            const participantCountValue = detailItems[3].querySelector('.chat-details-value');
            if (participantCountValue) participantCountValue.textContent = participants.length.toString();
        }
        
        console.log('[ChatPage] Updated conversation info section');
    } else {
        console.warn('[ChatPage] chat-session-details not found');
    }
    
    // Update participants list
    const participantsList = document.getElementById('chat-details-participants-list');
    if (participantsList) {
        participantsList.innerHTML = '';
        
        if (participants.length === 0) {
            participantsList.innerHTML = '<p class="chat-empty-text">No participants</p>';
        } else {
            participants.forEach(participant => {
                const user = participant.user || participant.User;
                const presence = participant.presence || participant.Presence;
                const role = participant.role || participant.Role;
                
                if (!user) {
                    console.warn('[ChatPage] Participant without user:', participant);
                    return;
                }
                
                const participantItem = document.createElement('div');
                participantItem.className = 'chat-participant-item';
                
                const avatar = document.createElement('div');
                avatar.className = 'chat-participant-avatar';
                const userId = user.id || user.Id;
                if (userId) {
                    avatar.style.backgroundColor = getAvatarColor(userId.toString());
                } else {
                    avatar.style.backgroundColor = '#007AFF';
                }
                const userName = user.displayName || user.DisplayName || user.username || user.Username || 'Unknown';
                avatar.textContent = getInitials(userName);
                
                const presenceStatus = presence?.status || presence?.Status;
                if (presenceStatus === 1) {
                    const dot = document.createElement('div');
                    dot.className = 'chat-presence-dot online';
                    avatar.appendChild(dot);
                }
                
                const name = document.createElement('div');
                name.className = 'chat-participant-name';
                name.textContent = userName;
                
                participantItem.appendChild(avatar);
                participantItem.appendChild(name);
                
                if (role === 3) { // Owner
                    const roleSpan = document.createElement('span');
                    roleSpan.className = 'chat-participant-role';
                    roleSpan.textContent = 'Owner';
                    participantItem.appendChild(roleSpan);
                } else if (role === 2) { // Admin
                    const roleSpan = document.createElement('span');
                    roleSpan.className = 'chat-participant-role';
                    roleSpan.textContent = 'Admin';
                    participantItem.appendChild(roleSpan);
                }
                
                participantsList.appendChild(participantItem);
            });
        }
        
        console.log('[ChatPage] Details panel updated with', participants.length, 'participants');
    } else {
        console.warn('[ChatPage] chat-details-participants-list not found');
    }
}

function formatDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    if (year !== today.getFullYear()) {
        return `${month} ${day}, ${year}`;
    }
    return `${month} ${day}`;
}

function getAvatarColor(id) {
    const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF6B6B'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Global functions for onclick handlers
function answerCall(callId) {
    if (chatConnection) {
        chatConnection.invoke("AnswerCall", callId);
    }
}

function rejectCall(callId) {
    if (chatConnection) {
        chatConnection.invoke("RejectCall", callId);
    }
}

window.answerCall = answerCall;
window.rejectCall = rejectCall;

window.selectConversation = function(conversationId) {
    console.log('[ChatPage] selectConversation called with:', conversationId, typeof conversationId);
    
    // Handle both string and dataset cases
    if (typeof conversationId === 'object' && conversationId?.target) {
        // Click event passed instead of ID
        const element = conversationId.target.closest('.chat-conversation-item');
        conversationId = element?.dataset?.conversationId || element?.getAttribute('data-conversation-id');
    }
    
    if (!conversationId || conversationId === 'undefined' || conversationId === 'null') {
        console.error('[ChatPage] No conversation ID provided, received:', conversationId);
        return;
    }
    if (!chatConnection || chatConnection.state !== signalR.HubConnectionState.Connected) {
        console.error('[ChatPage] Chat connection not ready, state:', chatConnection?.state);
        return;
    }
    
    // Update active state in UI
    document.querySelectorAll('.chat-conversation-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.conversationId === conversationId) {
            item.classList.add('active');
        }
    });
    
    currentConversationId = conversationId;
    console.log('[ChatPage] Invoking JoinConversation for:', conversationId);
    chatConnection.invoke("JoinConversation", conversationId)
        .then(() => {
            console.log('[ChatPage] JoinConversation invoked successfully');
        })
        .catch(err => {
            console.error('[ChatPage] Failed to join conversation:', err);
            alert('Failed to join conversation. Please try again.');
        });
};

window.sendMessage = sendMessage;

window.insertEmoji = function(emoji) {
    const input = document.getElementById('chat-input');
    if (input) {
        const pos = input.selectionStart;
        input.value = input.value.substring(0, pos) + emoji + input.value.substring(pos);
        input.focus();
        autoResizeTextarea(input);
    }
};

window.toggleReaction = function(messageId, emoji) {
    chatConnection.invoke("AddReaction", messageId, emoji);
};

window.downloadFile = function(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
};

window.showReactionPicker = function(messageId) {
    showReactionPicker(messageId);
};

// Set up emoji button handlers
document.addEventListener('DOMContentLoaded', () => {
    // Emoji buttons
    document.querySelectorAll('.chat-emoji-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const emoji = this.dataset.emoji;
            if (emoji) insertEmoji(emoji);
        });
    });
});

function showNewChatModal() {
    const modal = document.createElement('div');
    modal.className = 'chat-modal-overlay';
    
    const modalDiv = document.createElement('div');
    modalDiv.className = 'chat-modal';
    
    const header = document.createElement('div');
    header.className = 'chat-modal-header';
    const h3 = document.createElement('h3');
    h3.textContent = 'New Chat';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-modal-close';
    closeBtn.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';
    closeBtn.addEventListener('click', () => modal.remove());
    header.appendChild(h3);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'chat-modal-body';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'user-search-input';
    searchInput.placeholder = 'Search users...';
    searchInput.className = 'chat-search-input';
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'user-search-results';
    resultsDiv.className = 'chat-user-list';
    body.appendChild(searchInput);
    body.appendChild(resultsDiv);
    
    modalDiv.appendChild(header);
    modalDiv.appendChild(body);
    modal.appendChild(modalDiv);
    document.body.appendChild(modal);
    
    let searchTimeout;
    searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const users = await chatConnection.invoke("SearchUsers", query);
                resultsDiv.innerHTML = '';
                users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'chat-user-item';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'chat-user-avatar';
                    avatar.textContent = getInitials(user.DisplayName || user.Username);
                    
                    const info = document.createElement('div');
                    info.className = 'chat-user-info';
                    const name = document.createElement('div');
                    name.className = 'chat-user-name';
                    name.textContent = user.DisplayName || user.Username;
                    const username = document.createElement('div');
                    username.className = 'chat-user-username';
                    username.textContent = user.Username;
                    info.appendChild(name);
                    info.appendChild(username);
                    
                    item.appendChild(avatar);
                    item.appendChild(info);
                    
                    item.addEventListener('click', async () => {
                        try {
                            const conversationId = await chatConnection.invoke("CreateConversation", 1, null, [user.Id]);
                            modal.remove();
                            // Join the conversation instead of reloading
                            if (conversationId) {
                                await chatConnection.invoke("JoinConversation", conversationId);
                            }
                        } catch (err) {
                            console.error('Failed to create conversation:', err);
                            alert('Failed to create conversation. Please try again.');
                        }
                    });
                    resultsDiv.appendChild(item);
                });
            } catch (err) {
                console.error('User search failed:', err);
            }
        }, 300);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

function showNewGroupModal() {
    const modal = document.createElement('div');
    modal.className = 'chat-modal-overlay';
    
    const modalDiv = document.createElement('div');
    modalDiv.className = 'chat-modal';
    
    const header = document.createElement('div');
    header.className = 'chat-modal-header';
    const h3 = document.createElement('h3');
    h3.textContent = 'New Group';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chat-modal-close';
    closeBtn.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';
    closeBtn.addEventListener('click', () => modal.remove());
    header.appendChild(h3);
    header.appendChild(closeBtn);
    
    const body = document.createElement('div');
    body.className = 'chat-modal-body';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'group-name-input';
    nameInput.placeholder = 'Group name...';
    nameInput.className = 'chat-input mb-4';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'group-user-search';
    searchInput.placeholder = 'Search users to add...';
    searchInput.className = 'chat-search-input mb-4';
    
    const selectedDiv = document.createElement('div');
    selectedDiv.id = 'group-selected-users';
    selectedDiv.className = 'chat-selected-users mb-4';
    
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'group-user-results';
    resultsDiv.className = 'chat-user-list';
    
    const createBtn = document.createElement('button');
    createBtn.id = 'btn-create-group';
    createBtn.className = 'chat-button-primary mt-4';
    createBtn.textContent = 'Create Group';
    
    body.appendChild(nameInput);
    body.appendChild(searchInput);
    body.appendChild(selectedDiv);
    body.appendChild(resultsDiv);
    body.appendChild(createBtn);
    
    modalDiv.appendChild(header);
    modalDiv.appendChild(body);
    modal.appendChild(modalDiv);
    document.body.appendChild(modal);
    
    const selectedUsers = new Set();
    
    let searchTimeout;
    searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const users = await chatConnection.invoke("SearchUsers", query);
                resultsDiv.innerHTML = '';
                users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'chat-user-item';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'chat-user-avatar';
                    avatar.textContent = getInitials(user.DisplayName || user.Username);
                    
                    const info = document.createElement('div');
                    info.className = 'chat-user-info';
                    const name = document.createElement('div');
                    name.className = 'chat-user-name';
                    name.textContent = user.DisplayName || user.Username;
                    const username = document.createElement('div');
                    username.className = 'chat-user-username';
                    username.textContent = user.Username;
                    info.appendChild(name);
                    info.appendChild(username);
                    
                    item.appendChild(avatar);
                    item.appendChild(info);
                    
                    item.addEventListener('click', () => {
                        if (!selectedUsers.has(user.Id)) {
                            selectedUsers.add(user.Id);
                            updateSelectedUsers(selectedDiv, selectedUsers);
                        }
                    });
                    resultsDiv.appendChild(item);
                });
            } catch (err) {
                console.error('User search failed:', err);
            }
        }, 300);
    });
    
    createBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a group name');
            return;
        }
        if (selectedUsers.size === 0) {
            alert('Please add at least one user');
            return;
        }
        
        try {
            const conversationId = await chatConnection.invoke("CreateConversation", 2, name, Array.from(selectedUsers));
            modal.remove();
            // Join the conversation instead of reloading
            if (conversationId) {
                await chatConnection.invoke("JoinConversation", conversationId);
            }
        } catch (err) {
            console.error('Failed to create group:', err);
            alert('Failed to create group. Please try again.');
        }
    });
    
    if (window.lucide) window.lucide.createIcons();
}

function updateSelectedUsers(container, selectedUsers) {
    container.innerHTML = '';
    selectedUsers.forEach(userId => {
        const badge = document.createElement('span');
        badge.className = 'chat-selected-user-badge';
        badge.textContent = userId;
        badge.innerHTML += '<i data-lucide="x" class="w-3 h-3 ml-1"></i>';
        badge.onclick = () => {
            selectedUsers.delete(userId);
            updateSelectedUsers(container, selectedUsers);
        };
        container.appendChild(badge);
    });
    if (window.lucide) window.lucide.createIcons();
}

function filterConversationsUI(query) {
    const items = document.querySelectorAll('.chat-conversation-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
        const name = item.querySelector('.chat-conversation-name')?.textContent || '';
        const preview = item.querySelector('.chat-conversation-preview')?.textContent || '';
        const matches = name.toLowerCase().includes(lowerQuery) || preview.toLowerCase().includes(lowerQuery);
        item.style.display = matches ? '' : 'none';
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        e.target.value = '';
        return;
    }
    
    selectedFile = file;
    updateFilePreview();
    e.target.value = '';
}

function updateFilePreview() {
    const preview = document.getElementById('chat-file-preview');
    const fileName = document.getElementById('chat-file-name');
    const fileSize = document.getElementById('chat-file-size');
    const filePreviewImg = document.getElementById('chat-file-preview-img');
    
    if (!preview) return;
    
    if (selectedFile) {
        preview.classList.remove('hidden');
        if (fileName) fileName.textContent = selectedFile.name;
        if (fileSize) fileSize.textContent = `(${(selectedFile.size / 1024).toFixed(1)} KB)`;
        
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
        if (filePreviewImg) filePreviewImg.classList.add('hidden');
    }
}

async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
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

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatPage);
} else {
    initChatPage();
}
