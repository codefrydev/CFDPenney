// --- State ---
let currentTab = 'chat';
let activeChatId = null;
let activeTeamChannel = { teamId: null, channelId: null };
let callTimerInterval;
let users = {};
let chats = [];
let teams = [];
let calendarEvents = [];
let activities = [];
let calls = [];
let appsData = [
    { name: "Tasks", icon: "fa-solid fa-list-check", color: "text-green-600" },
    { name: "Approvals", icon: "fa-solid fa-file-circle-check", color: "text-blue-600" },
    { name: "Wiki", icon: "fa-solid fa-book-open", color: "text-purple-600" },
    { name: "OneNote", icon: "fa-solid fa-book", color: "text-purple-800" },
    { name: "Excel", icon: "fa-solid fa-file-excel", color: "text-green-700" },
    { name: "Power BI", icon: "fa-solid fa-chart-simple", color: "text-yellow-600" },
];

// SignalR connection
let connection = null;

// Initialize SignalR
function initSignalR() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/hubs/chat")
        .build();

    connection.on("ReceiveMessage", (message) => {
        if (message.chatId === activeChatId) {
            renderMessageBubble(message, null, false);
            scrollToBottom();
        }
        // Refresh chat sidebar
        if (currentTab === 'chat') {
            renderChatSidebar();
        }
    });

    connection.on("UserOnline", (data) => {
        if (users[data.userId]) {
            users[data.userId].status = "available";
        }
    });

    connection.on("UserOffline", (data) => {
        if (users[data.userId]) {
            users[data.userId].status = "offline";
        }
    });

    connection.start().catch(err => console.error("SignalR connection error:", err));
}

// Load data from backend
async function loadUsers() {
    try {
        const url = window.apiUrls?.users || '/Users?handler=Users';
        const response = await fetch(url);
        const result = await response.json();
        if (result.success && result.data) {
            const userMap = {};
            result.data.forEach(u => {
                userMap[u.id] = u;
            });
            users = userMap;
        }
    } catch (err) {
        console.error("Error loading users:", err);
    }
}

async function loadChats() {
    try {
        const url = window.apiUrls?.chats || '/Chats?handler=Chats';
        const response = await fetch(url);
        const result = await response.json();
        if (result.success && result.data) {
            chats = result.data;
            if (chats.length > 0 && !activeChatId) {
                activeChatId = chats[0].id;
            }
        }
    } catch (err) {
        console.error("Error loading chats:", err);
    }
}

async function loadTeams() {
    try {
        const url = window.apiUrls?.teams || '/Teams?handler=Teams';
        const response = await fetch(url);
        const result = await response.json();
        if (result.success && result.data) {
            teams = result.data;
            if (teams.length > 0 && !activeTeamChannel.teamId) {
                activeTeamChannel.teamId = teams[0].id;
                if (teams[0].channels.length > 0) {
                    activeTeamChannel.channelId = teams[0].channels[0].id;
                }
            }
        }
    } catch (err) {
        console.error("Error loading teams:", err);
    }
}

async function loadCalendarEvents() {
    try {
        const url = window.apiUrls?.calendarEvents || '/Calendar?handler=Events';
        const response = await fetch(url);
        const result = await response.json();
        if (result.success && result.data) {
            calendarEvents = result.data;
        }
    } catch (err) {
        console.error("Error loading calendar events:", err);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    await loadChats();
    await loadTeams();
    await loadCalendarEvents();
    initSignalR();
    switchMainTab('chat');
});

// --- Rich Text Functions ---
function formatDoc(cmd, value = null) {
    document.execCommand(cmd, false, value);
    const editor = document.getElementById('message-editor');
    if (editor) editor.focus();
}

function addLink() {
    const url = prompt("Enter the URL:");
    if (url) formatDoc('createLink', url);
}

function handleEditorKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// --- Render Functions ---
function switchMainTab(tabName) {
    currentTab = tabName;

    // Sidebar visual update
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabName)) {
            item.classList.add('active');
        }
    });

    const secondarySidebar = document.getElementById('secondary-sidebar');
    const inputArea = document.getElementById('input-area');
    const header = document.getElementById('chat-header');
    const mainContent = document.getElementById('message-container');

    // Reset Layout
    mainContent.innerHTML = '';
    header.innerHTML = '';
    inputArea.classList.add('hidden');
    secondarySidebar.classList.remove('hidden');

    if (tabName === 'chat') {
        document.getElementById('section-title').innerText = 'Chat';
        renderChatSidebar();
        if (activeChatId) {
            selectChat(activeChatId);
        }
    } else if (tabName === 'teams') {
        document.getElementById('section-title').innerText = 'Teams';
        renderTeamsSidebar();
        if (activeTeamChannel.teamId && activeTeamChannel.channelId) {
            selectTeamChannel(activeTeamChannel.teamId, activeTeamChannel.channelId);
        }
    } else if (tabName === 'activity') {
        document.getElementById('section-title').innerText = 'Feed';
        renderActivitySidebar();
        renderActivityMain();
    } else if (tabName === 'calendar') {
        secondarySidebar.classList.add('hidden');
        renderCalendarMain();
    } else if (tabName === 'calls') {
        document.getElementById('section-title').innerText = 'Calls';
        renderCallsSidebar();
        renderCallsMain();
    } else if (tabName === 'apps') {
        secondarySidebar.classList.add('hidden');
        renderAppsMain();
    }
}

// --- CHAT Logic ---
function renderChatSidebar() {
    const container = document.getElementById('list-container');
    if (!container) return;
    container.innerHTML = '';

    const pinnedHeader = document.createElement('div');
    pinnedHeader.className = "px-3 py-2 text-xs font-semibold text-[#616161] flex items-center cursor-pointer hover:bg-[#edebe9] mt-2 mb-1";
    pinnedHeader.innerHTML = '<i class="fa-solid fa-chevron-down mr-2 text-[10px]"></i> Pinned';
    container.appendChild(pinnedHeader);

    chats.forEach(chat => {
        const user = users[chat.userId] || { name: "Unknown", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User", status: "offline" };
        const isActive = chat.id === activeChatId;
        const el = document.createElement('div');
        el.className = `flex items-center px-3 py-2.5 rounded cursor-pointer transition-colors relative group mb-0.5 ${isActive ? 'bg-white shadow-sm' : 'hover:bg-[#edebe9]'}`;
        el.onclick = () => selectChat(chat.id);

        let previewText = chat.lastMessage || "";
        if (previewText.includes('<')) previewText = "Sent a rich text message";

        el.innerHTML = `
            <div class="relative mr-3 shrink-0">
                <img src="${user.avatar}" class="w-8 h-8 rounded-full border border-gray-200">
                <div class="status-dot ${user.status === 'available' ? 'status-available' : user.status === 'busy' ? 'status-busy' : 'status-away'}"></div>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-0.5">
                    <h3 class="${chat.unread > 0 ? 'font-bold' : 'font-normal'} text-sm truncate">${user.name}</h3>
                    <span class="text-[10px] text-[#616161]">${chat.timestamp || ''}</span>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-xs truncate ${chat.unread > 0 ? 'font-semibold text-[#242424]' : 'text-[#616161]'} flex-1">${previewText}</p>
                    ${chat.unread > 0 ? `<div class="ml-2 bg-[#c4314b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm leading-none">${chat.unread}</div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(el);
    });
}

async function selectChat(chatId) {
    activeChatId = chatId;
    const inputArea = document.getElementById('input-area');
    if (inputArea) inputArea.classList.remove('hidden');
    renderChatSidebar();

    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const user = users[chat.userId] || { name: "Unknown", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User" };
    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');

    if (header) {
        header.innerHTML = `
            <div class="flex items-center space-x-3 cursor-pointer hover:bg-[#f0f0f0] p-1.5 -ml-2 pr-3 rounded transition-colors group">
                <img src="${user.avatar}" class="w-9 h-9 rounded-full border border-gray-200">
                <div>
                    <h2 class="font-bold text-[16px] leading-tight text-[#242424] flex items-center group-hover:text-[#5b5fc7] transition-colors">${user.name}</h2>
                    <div class="flex items-center text-xs text-[#616161] space-x-2 mt-0.5">
                        <span class="hover:underline cursor-pointer text-[#5b5fc7] font-semibold">Chat</span>
                        <span class="text-[#e1dfdd]">|</span>
                        <span class="hover:underline cursor-pointer hover:text-[#5b5fc7]">Files</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-1">
                <button class="w-8 h-8 flex items-center justify-center rounded hover:bg-[#edebe9] text-[#5b5fc7]" onclick="startVideoCall('${user.name}', 'video')"><i class="fa-solid fa-video"></i></button>
                <button class="w-8 h-8 flex items-center justify-center rounded hover:bg-[#edebe9] text-[#5b5fc7]" onclick="startVideoCall('${user.name}', 'audio')"><i class="fa-solid fa-phone"></i></button>
            </div>
        `;
    }

    if (msgContainer) {
        msgContainer.innerHTML = '';
        const dateSep = document.createElement('div');
        dateSep.className = "flex items-center justify-center mb-6 mt-6 relative";
        dateSep.innerHTML = `<div class="absolute inset-0 flex items-center"><div class="w-full border-t border-[#e1dfdd]"></div></div><span class="relative bg-white px-4 text-xs font-semibold text-[#616161]">Today</span>`;
        msgContainer.appendChild(dateSep);

        if (chat.messages && chat.messages.length > 0) {
            let lastSenderId = null;
            chat.messages.forEach(msg => {
                const isSequence = lastSenderId === msg.senderId;
                renderMessageBubble(msg, user, isSequence);
                lastSenderId = msg.senderId;
            });
        }
        scrollToBottom();
    }

    // Join SignalR group for this chat
    if (connection) {
        await connection.invoke("JoinChat", chatId);
    }
}

function renderMessageBubble(msg, chatUser, isSequence) {
    const msgContainer = document.getElementById('message-container');
    if (!msgContainer) return;

    const isMe = msg.senderId === 'me' || msg.senderId === "me";
    let avatarSrc, senderName;
    if (isMe) {
        avatarSrc = "https://api.dicebear.com/7.x/avataaars/svg?seed=Me";
        senderName = "You";
    } else {
        const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId.toString();
        const senderObj = users[senderId] || chatUser || { avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User", name: "User" };
        avatarSrc = senderObj.avatar;
        senderName = senderObj.name;
    }

    const div = document.createElement('div');
    div.className = `flex group pl-2 animate-fade-in ${isSequence ? 'mt-1' : 'mt-4'}`;

    const avatarHtml = isSequence ? `<div class="w-8 h-8 mr-3"></div>` : `<div class="mr-3 flex-shrink-0 pt-1 cursor-pointer hover:opacity-80"><img src="${avatarSrc}" class="w-8 h-8 rounded-full border border-gray-200"></div>`;
    const headerHtml = isSequence ? `` : `<div class="flex items-baseline space-x-2 mb-1"><span class="font-semibold text-xs text-[#242424] cursor-pointer hover:underline">${senderName}</span><span class="text-[10px] text-[#616161]">${msg.time || ''}</span></div>`;

    div.innerHTML = `
        ${avatarHtml}
        <div class="flex-1 min-w-0">
            ${headerHtml}
            <div class="relative inline-block max-w-[85%]">
                 <div class="rich-text-content px-4 py-2.5 rounded-md text-sm shadow-sm ${isMe ? 'message-bubble-mine' : 'message-bubble-other'}">
                    ${msg.text || ''}
                 </div>
            </div>
        </div>
    `;
    msgContainer.appendChild(div);
}

function scrollToBottom() {
    const container = document.getElementById('message-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

async function sendMessage() {
    const editor = document.getElementById('message-editor');
    if (!editor || !activeChatId) return;

    const text = editor.innerHTML;
    const plainText = editor.innerText.trim();
    if (!plainText && !text.includes('<img')) return;

    try {
        const url = window.apiUrls?.sendMessage || '/Chats?handler=SendMessage';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatId: activeChatId,
                text: text
            })
        });

        const result = await response.json();
        if (result.success) {
            editor.innerHTML = '';
            scrollToBottom();
            await loadChats();
            renderChatSidebar();
        }
    } catch (err) {
        console.error("Error sending message:", err);
    }
}

// --- TEAMS Logic ---
function renderTeamsSidebar() {
    const container = document.getElementById('list-container');
    if (!container) return;
    container.innerHTML = '';

    teams.forEach(team => {
        const teamEl = document.createElement('div');
        teamEl.className = "mb-2";
        teamEl.innerHTML = `
            <div class="flex items-center px-2 py-1 cursor-pointer hover:bg-[#edebe9] text-[#242424] font-bold text-xs uppercase tracking-wide">
                <i class="fa-solid fa-chevron-down mr-2 text-[10px] text-[#616161]"></i>
                <i class="${team.icon || 'fa-solid fa-users'} mr-2 text-[#5b5fc7]"></i> ${team.name}
            </div>
        `;

        if (team.channels) {
            team.channels.forEach(channel => {
                const isActive = activeTeamChannel.teamId === team.id && activeTeamChannel.channelId === channel.id;
                const chanEl = document.createElement('div');
                chanEl.className = `flex items-center px-8 py-1.5 cursor-pointer text-sm ${isActive ? 'bg-[#e8ebfa] text-[#242424] font-semibold' : 'text-[#424242] hover:bg-[#edebe9]'}`;
                chanEl.innerText = channel.name;
                chanEl.onclick = () => selectTeamChannel(team.id, channel.id);
                teamEl.appendChild(chanEl);
            });
        }

        container.appendChild(teamEl);
    });
}

async function selectTeamChannel(teamId, channelId) {
    activeTeamChannel = { teamId, channelId };
    renderTeamsSidebar();

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const channel = team.channels?.find(c => c.id === channelId);
    if (!channel) return;

    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');
    const inputArea = document.getElementById('input-area');
    if (inputArea) inputArea.classList.add('hidden');

    if (header) {
        header.innerHTML = `
            <div class="flex items-center space-x-3 px-2">
                <div class="w-8 h-8 bg-[#e8ebfa] rounded flex items-center justify-center text-[#5b5fc7]"><i class="${team.icon || 'fa-solid fa-users'}"></i></div>
                <div>
                    <h2 class="font-bold text-[16px] text-[#242424]">${channel.name}</h2>
                    <div class="text-xs text-[#616161]">Posts | Files | Notes</div>
                </div>
            </div>
        `;
    }

    if (msgContainer) {
        msgContainer.innerHTML = '<div class="p-6 space-y-6"></div>';
        const innerContainer = msgContainer.firstElementChild;

        if (!channel.posts || channel.posts.length === 0) {
            innerContainer.innerHTML = `<div class="text-center text-gray-400 mt-10"><i class="fa-solid fa-comments text-4xl mb-2"></i><br>Start a new conversation</div>`;
        } else {
            channel.posts.forEach(post => {
                const postUser = users[post.user] || { name: "User", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User" };
                const postEl = document.createElement('div');
                postEl.className = "bg-white border border-[#e1dfdd] rounded-md p-4 shadow-sm";

                let repliesHtml = '';
                if (post.replies && post.replies.length > 0) {
                    repliesHtml = `<div class="mt-3 pl-4 border-l-2 border-[#e1dfdd] space-y-2">
                        ${post.replies.map(r => {
                            const replyUser = users[r.user] || { name: "User" };
                            return `
                            <div class="flex items-start space-x-2">
                                <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                    ${replyUser.name[0] || 'U'}
                                </div>
                                <div class="bg-[#f3f2f1] px-3 py-1.5 rounded-r-md rounded-bl-md text-xs text-[#242424]">
                                    <span class="font-bold">${replyUser.name}</span> ${r.text}
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>`;
                }

                postEl.innerHTML = `
                    <div class="flex items-start space-x-3 mb-2">
                        <img src="${postUser.avatar}" class="w-9 h-9 rounded-full border border-gray-200">
                        <div>
                            <div class="flex items-baseline space-x-2">
                                <span class="font-bold text-sm text-[#242424]">${postUser.name}</span>
                                <span class="text-xs text-[#616161]">${post.time || ''}</span>
                            </div>
                            <div class="text-sm text-[#242424] mt-1">${post.text || ''}</div>
                        </div>
                    </div>
                    ${repliesHtml}
                    <div class="mt-3 flex items-center space-x-4">
                        <button class="text-xs font-semibold text-[#5b5fc7] hover:underline">Reply</button>
                        <button class="text-xs text-[#616161] hover:underline">Collapse</button>
                    </div>
                `;
                innerContainer.appendChild(postEl);
            });
        }
    }
}

// --- ACTIVITY Logic ---
function renderActivitySidebar() {
    const container = document.getElementById('list-container');
    if (!container) return;
    container.innerHTML = '';

    activities.forEach(act => {
        const el = document.createElement('div');
        el.className = `flex items-start px-3 py-3 cursor-pointer hover:bg-[#edebe9] border-b border-transparent ${!act.read ? 'bg-white border-l-4 border-l-[#5b5fc7] font-semibold' : ''}`;
        el.innerHTML = `
            <div class="relative mr-3 shrink-0 pt-1">
                <i class="${act.icon || 'fa-solid fa-bell'} text-lg"></i>
            </div>
            <div>
                <div class="text-sm line-clamp-2 ${!act.read ? 'text-[#242424]' : 'text-[#424242]'}">${act.text}</div>
                <div class="text-xs text-[#616161] mt-1">${act.time}</div>
            </div>
        `;
        container.appendChild(el);
    });
}

function renderActivityMain() {
    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');
    if (header) header.innerHTML = `<h2 class="font-bold text-lg px-5 text-[#242424]">Feed</h2>`;
    if (msgContainer) {
        msgContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400">
            <i class="fa-solid fa-bell text-4xl mb-4 text-[#e1dfdd]"></i>
            <p>Select an item from the feed to view details.</p>
        </div>`;
    }
}

// --- CALENDAR Logic ---
function renderCalendarMain() {
    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');

    if (header) {
        header.innerHTML = `
            <div class="flex items-center justify-between w-full px-4 h-full">
                <div class="flex items-center space-x-4">
                    <div class="flex items-center bg-[#f3f2f1] rounded p-0.5">
                        <button class="px-3 py-1 text-xs font-semibold text-[#242424] bg-white shadow-sm rounded-sm">Work week</button>
                        <button class="px-3 py-1 text-xs font-medium text-[#616161] hover:text-[#242424]">Day</button>
                    </div>
                    <h2 class="font-bold text-lg text-[#242424]">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                    <div class="flex items-center space-x-1">
                        <button class="p-1.5 hover:bg-[#f0f0f0] rounded text-[#616161]"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                        <button class="px-2 py-1 hover:bg-[#f0f0f0] rounded text-sm font-medium text-[#242424]">Today</button>
                        <button class="p-1.5 hover:bg-[#f0f0f0] rounded text-[#616161]"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="px-3 py-1.5 border border-[#d1d1d1] text-[#242424] text-sm font-semibold rounded hover:bg-gray-50 flex items-center"><i class="fa-solid fa-video mr-2"></i>Meet now</button>
                    <button class="px-3 py-1.5 bg-[#5b5fc7] text-white text-sm font-semibold rounded hover:bg-[#464775] shadow-sm flex items-center"><i class="fa-solid fa-plus mr-2"></i>New meeting</button>
                </div>
            </div>
        `;
    }

    if (msgContainer) {
        // Simplified calendar rendering - can be enhanced
        msgContainer.innerHTML = `<div class="p-6"><p class="text-gray-500">Calendar view - events will be displayed here</p></div>`;
    }
}

// --- APPS Logic ---
function renderAppsMain() {
    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');
    if (header) header.innerHTML = `<h2 class="font-bold text-lg px-5 text-[#242424]">Apps</h2>`;

    if (msgContainer) {
        let html = `<div class="p-8 grid grid-cols-3 gap-6">`;
        appsData.forEach(app => {
            html += `
                <div class="bg-white border border-[#e1dfdd] rounded-lg p-6 hover:shadow-md cursor-pointer transition-shadow flex items-start space-x-4">
                    <i class="${app.icon} text-3xl ${app.color}"></i>
                    <div>
                        <h3 class="font-bold text-lg text-[#242424]">${app.name}</h3>
                        <p class="text-sm text-[#616161] mt-1">Boost productivity with the ${app.name} integration.</p>
                        <button class="mt-4 px-3 py-1 bg-white border border-[#d1d1d1] text-xs font-semibold rounded hover:bg-gray-50">Open</button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        msgContainer.innerHTML = html;
    }
}

// --- CALLS Logic ---
function renderCallsSidebar() {
    const container = document.getElementById('list-container');
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = "px-3 py-2 text-xs font-semibold text-[#616161] mt-2 mb-1";
    header.innerText = "Speed Dial";
    container.appendChild(header);

    Object.values(users).forEach(user => {
        const el = document.createElement('div');
        el.className = "flex items-center px-3 py-3 cursor-pointer hover:bg-[#edebe9] group rounded-md mx-2";
        el.innerHTML = `
            <img src="${user.avatar}" class="w-10 h-10 rounded-full mr-3 border border-gray-200">
            <div class="flex-1">
                <h3 class="font-semibold text-sm text-[#242424]">${user.name}</h3>
                <p class="text-xs text-[#616161]">${user.role || 'User'}</p>
            </div>
            <button class="opacity-0 group-hover:opacity-100 text-[#616161] hover:text-[#5b5fc7] transition-opacity p-2" onclick="startVideoCall('${user.name}', 'video')"><i class="fa-solid fa-video"></i></button>
            <button class="opacity-0 group-hover:opacity-100 text-[#616161] hover:text-[#5b5fc7] transition-opacity p-2 ml-1" onclick="startVideoCall('${user.name}', 'audio')"><i class="fa-solid fa-phone"></i></button>
        `;
        container.appendChild(el);
    });
}

function renderCallsMain() {
    const header = document.getElementById('chat-header');
    const msgContainer = document.getElementById('message-container');
    if (header) header.innerHTML = `<h2 class="text-lg font-bold px-5 text-[#242424]">History</h2>`;

    if (msgContainer) {
        let html = `<div class="p-6"><div class="bg-white rounded border border-[#e1dfdd]"><table class="w-full text-left text-sm">
            <thead class="bg-[#faf9f8] border-b border-[#e1dfdd] text-xs text-[#616161] font-semibold uppercase"><tr class="h-10"><th class="pl-4">Name</th><th>Type</th><th>Duration</th><th>Date</th></tr></thead>
            <tbody>`;
        calls.forEach(c => {
            const u = users[c.userId] || { name: "Unknown", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=User" };
            html += `<tr class="border-b border-[#f3f2f1] hover:bg-[#faf9f8] h-12">
                <td class="pl-4 font-medium flex items-center h-12"><img src="${u.avatar}" class="w-6 h-6 rounded-full mr-3">${u.name}</td>
                <td class="text-[#616161]">${c.type === 'incoming' ? (c.status === 'missed' ? '<i class="fa-solid fa-arrow-down text-[#c4314b] mr-2"></i> Missed' : '<i class="fa-solid fa-arrow-down text-[#616161] mr-2"></i> Incoming') : '<i class="fa-solid fa-arrow-up text-[#616161] mr-2"></i> Outgoing'}</td>
                <td class="text-[#616161] font-mono">${c.duration || '0:00'}</td>
                <td class="text-[#616161]">${c.time || ''}</td>
            </tr>`;
        });
        html += `</tbody></table></div></div>`;
        msgContainer.innerHTML = html;
    }
}

// --- Video/Audio Call Logic ---
function startVideoCall(name, type) {
    const overlay = document.getElementById('video-call-overlay');
    const title = document.getElementById('call-title');
    const timer = document.getElementById('call-timer');
    const content = document.getElementById('call-content-area');

    if (!overlay || !title || !timer || !content) return;

    title.innerText = `Calling ${name}...`;
    timer.innerText = "Connecting...";
    overlay.classList.remove('hidden');

    if (type === 'audio') {
        content.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="w-32 h-32 rounded-full bg-gradient-to-br from-[#5b5fc7] to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl pulse-avatar mb-6">
                    ${name[0]}
                </div>
                <h2 class="text-2xl font-bold">${name}</h2>
                <p class="text-gray-400 mt-2">Teams Audio Call</p>
            </div>
        `;
    } else {
        content.innerHTML = `
        <div class="video-grid" id="video-grid-container">
            <div class="bg-gray-800 rounded-lg relative overflow-hidden flex items-center justify-center border border-gray-700 shadow-lg">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80" class="w-full h-full object-cover opacity-80">
                 <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm text-xs font-medium text-white">${name}</div>
            </div>
             <div class="bg-gray-800 rounded-lg relative overflow-hidden flex items-center justify-center border border-gray-700 shadow-lg">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-[#5b5fc7] to-purple-600 flex items-center justify-center text-3xl font-bold shadow-inner">ME</div>
                <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm text-xs font-medium text-white">You</div>
            </div>
        </div>`;
    }

    let seconds = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        seconds++;
        const min = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        timer.innerText = `${min}:${sec}`;
        if (seconds === 1) title.innerText = type === 'audio' ? `Call with ${name}` : 'Video Call';
    }, 1000);
}

function endVideoCall() {
    const overlay = document.getElementById('video-call-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (callTimerInterval) clearInterval(callTimerInterval);
}

function toggleCallState(btn, type) {
    btn.classList.toggle('bg-white');
    btn.classList.toggle('text-gray-900');
    const icon = btn.querySelector('i');
    if (type === 'video') {
        icon.classList.toggle('fa-video');
        icon.classList.toggle('fa-video-slash');
    } else {
        icon.classList.toggle('fa-microphone');
        icon.classList.toggle('fa-microphone-slash');
    }
}

function toggleProfileModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('profile-modal');
    const profileTrigger = document.querySelector('[onclick*="toggleProfileModal"]');
    if (modal && !modal.classList.contains('hidden') && !modal.contains(e.target) && profileTrigger && !profileTrigger.contains(e.target)) {
        modal.classList.add('hidden');
    }
});

// --- SETTINGS LOGIC ---
function openSettings() {
    const settingsModal = document.getElementById('settings-modal');
    const profileModal = document.getElementById('profile-modal');
    if (settingsModal) settingsModal.classList.remove('hidden');
    if (profileModal) profileModal.classList.add('hidden');
}

function closeSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');
}

function switchSettingsTab(tabId) {
    ['general', 'privacy', 'notifications', 'appearance'].forEach(id => {
        const tab = document.getElementById(`settings-${id}`);
        if (tab) tab.classList.add('hidden');
    });
    const selectedTab = document.getElementById(`settings-${tabId}`);
    if (selectedTab) selectedTab.classList.remove('hidden');

    const items = document.querySelectorAll('.settings-nav-item');
    items.forEach(item => {
        item.classList.remove('font-semibold', 'bg-[#e1dfdd]', 'active');
        const onclick = item.getAttribute('onclick');
        if (onclick && onclick.includes(tabId)) {
            item.classList.add('font-semibold', 'bg-[#e1dfdd]', 'active');
        }
    });
}

function signOut() {
    window.location.href = '/Login?handler=Logout';
}
