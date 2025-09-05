// Modern FlowSec Dashboard Script
class FlowSecDashboard {
    constructor() {
        this.API_BASE = 'http://localhost:5000/api';
        this.socket = null;
        this.currentChatId = null;
        this.chats = [];
        this.chatUsers = {};
        this.userEmail = null;
        this.myUsername = null;
        this.myProfileIcon = null;
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.enableDemoMode();
        await this.setupWebSocket();
        await this.loadUserProfile();
        this.bindEvents();
        this.loadChats();
        this.setupMobileMenu();
    }

    enableDemoMode() {
        // Add demo mode indicator
        const demoIndicator = document.createElement('div');
        demoIndicator.innerHTML = '🔧 DEMO MODE - Network Required for Full Functionality';
        demoIndicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b35;
            color: white;
            text-align: center;
            padding: 8px;
            font-size: 14px;
            z-index: 10000;
            font-weight: 500;
        `;
        document.body.prepend(demoIndicator);
        
        // Add navigation buttons
        const navButtons = document.createElement('div');
        navButtons.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
                <button onclick="window.location.href='dashboard.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">Dashboard</button>
                <button onclick="window.location.href='vault.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">Vault</button>
                <button onclick="window.location.href='index.html'" style="margin: 5px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer;">Home</button>
            </div>
        `;
        document.body.appendChild(navButtons);
        
        // Load demo data
        this.loadDemoData();
    }

    loadDemoData() {
        // Demo chats
        this.chats = [
            {
                _id: 'demo1',
                users: ['demo@flowsec.com', 'alice@example.com'],
                name: 'Alice Johnson',
                lastMessage: 'Hey! How are you?',
                unreadCount: 2,
                updatedAt: new Date().toISOString()
            },
            {
                _id: 'demo2', 
                users: ['demo@flowsec.com', 'bob@example.com'],
                name: 'Bob Smith',
                lastMessage: 'Check out this link...',
                unreadCount: 0,
                updatedAt: new Date(Date.now() - 3600000).toISOString()
            }
        ];
        
        // Demo messages for current chat
        this.demoMessages = [
            {
                _id: 'msg1',
                chatId: 'demo1',
                sender: 'alice@example.com',
                encrypted: 'Hello! How are you doing today?',
                createdAt: new Date(Date.now() - 7200000).toISOString()
            },
            {
                _id: 'msg2',
                chatId: 'demo1', 
                sender: 'demo@flowsec.com',
                encrypted: 'I\'m doing great! Just working on some projects.',
                createdAt: new Date(Date.now() - 3600000).toISOString()
            },
            {
                _id: 'msg3',
                chatId: 'demo1',
                sender: 'alice@example.com', 
                encrypted: 'That sounds awesome! 🚀',
                createdAt: new Date(Date.now() - 1800000).toISOString()
            }
        ];
    }

    async checkAuth() {
        this.userEmail = localStorage.getItem('userEmail');
        if (!this.userEmail) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.email) {
                this.userEmail = user.email;
                localStorage.setItem('userEmail', user.email);
            } else {
                window.location.href = 'index.html';
                return;
            }
        }
    }

    async setupWebSocket() {
        // WebSocket connection for real-time messaging
        try {
            this.socket = new WebSocket(`ws://localhost:5000?email=${encodeURIComponent(this.userEmail)}`);
            
            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.hideLoadingOverlay();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Connection error. Some features may not work.', 'warning');
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => this.setupWebSocket(), 3000);
            };
        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
        }
    }

    async loadUserProfile() {
        try {
            // Use demo data in offline mode
            this.myUsername = 'DemoUser';
            this.myProfileIcon = null;
            
            document.getElementById('my-username').textContent = this.myUsername;
            
            const profileImg = document.getElementById('my-profile-icon');
            if (this.myProfileIcon) {
                profileImg.src = this.myProfileIcon;
                profileImg.style.display = 'block';
                profileImg.nextElementSibling.style.display = 'none';
            } else {
                profileImg.style.display = 'none';
                profileImg.nextElementSibling.style.display = 'flex';
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            this.showNotification('Failed to load profile information.', 'error');
        }
    }

    bindEvents() {
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Search and start chat
        document.getElementById('search-username-btn')?.addEventListener('click', () => this.startNewChat());
        document.getElementById('search-username')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startNewChat();
        });

        // New chat button
        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.focusSearchInput());

        // Message form
        document.getElementById('message-form')?.addEventListener('submit', (e) => this.sendMessage(e));

        // File upload
        document.getElementById('file-input')?.addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('file-upload-btn')?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
        });

        // Action buttons
        document.getElementById('video-call-btn')?.addEventListener('click', () => this.startVideoCall());
        document.getElementById('voice-call-btn')?.addEventListener('click', () => this.startVoiceCall());

        // Emoji button (placeholder)
        document.querySelector('.emoji-btn')?.addEventListener('click', () => {
            this.showNotification('Emoji picker coming soon!', 'info');
        });
    }

    setupMobileMenu() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar when clicking on main content on mobile
            document.querySelector('.main-content')?.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    async loadChats() {
        try {
            // Use demo data in offline mode
            this.renderChatList();
        } catch (error) {
            console.error('Failed to load chats:', error);
            this.showNotification('Failed to load chat list.', 'error');
        }
    }

    renderChatList() {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;

        chatList.innerHTML = '';

        if (this.chats.length === 0) {
            chatList.innerHTML = `
                <li class="empty-state">
                    <div class="empty-icon">💬</div>
                    <p>No chats yet</p>
                    <small>Search for a user to start chatting</small>
                </li>
            `;
            return;
        }

        this.chats.forEach(chat => {
            const chatItem = document.createElement('li');
            chatItem.className = `chat-item ${chat._id === this.currentChatId ? 'active' : ''}`;
            chatItem.onclick = () => this.selectChat(chat._id);

            const otherUserEmail = chat.users.find(u => u !== this.userEmail);
            const lastMessage = chat.lastMessage || 'No messages yet';
            const timestamp = chat.updatedAt ? this.formatTime(new Date(chat.updatedAt)) : '';

            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <div class="avatar-placeholder">${chat.name?.charAt(0).toUpperCase() || '?'}</div>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${chat.name || 'Unknown User'}</div>
                    <div class="chat-preview">${lastMessage}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${timestamp}</div>
                    ${chat.unreadCount ? `<div class="chat-badge">${chat.unreadCount}</div>` : ''}
                </div>
            `;

            chatList.appendChild(chatItem);
        });
    }

    async selectChat(chatId) {
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c._id === chatId);
        
        if (!chat) return;

        // Update UI
        this.updateChatHeader(chat);
        this.renderChatList(); // Re-render to update active state
        this.loadDemoMessages(chatId);

        // Close mobile sidebar
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }

    updateChatHeader(chat) {        
        document.getElementById('chat-title').textContent = chat.name || 'Unknown User';
        document.getElementById('chat-status').textContent = 'Online'; // Placeholder

        const chatAvatar = document.querySelector('.top-bar .chat-avatar .avatar-placeholder');
        if (chatAvatar) {
            chatAvatar.textContent = chat.name?.charAt(0).toUpperCase() || '?';
        }
    }

    loadDemoMessages(chatId) {
        // Filter demo messages for this chat
        const messages = this.demoMessages.filter(msg => msg.chatId === chatId);
        this.renderMessages(messages);
    }

    async loadMessages(chatId) {
        try {
            const response = await fetch(`${this.API_BASE}/messages?chatId=${chatId}`);
            const data = await response.json();
            
            if (data.messages) {
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showNotification('Failed to load messages.', 'error');
        }
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">💬</div>
                    <h3>Start the conversation</h3>
                    <p>Send your first message to begin this chat.</p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            messagesContainer.appendChild(messageEl);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isMe = message.sender === this.userEmail;
        
        messageDiv.className = `message ${isMe ? 'sent' : 'received'}`;
        
        const content = message.fileUrl ? 
            `<a href="${message.fileUrl}" target="_blank" class="file-link">📎 ${message.fileName || 'File'}</a>` :
            message.content;

        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${content}
            </div>
            <div class="message-time">${this.formatTime(new Date(message.timestamp))}</div>
        `;

        return messageDiv;
    }

    async sendMessage(e) {
        e.preventDefault();
        
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChatId) return;

        try {
            const message = {
                chatId: this.currentChatId,
                content: content,
                sender: this.userEmail,
                timestamp: new Date().toISOString()
            };

            // Send via WebSocket
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'message',
                    data: message
                }));
            }

            // Add to UI immediately
            const messageEl = this.createMessageElement(message);
            document.getElementById('messages').appendChild(messageEl);
            document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

            // Clear input
            messageInput.value = '';

        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message.', 'error');
        }
    }

    async startNewChat() {
        const usernameInput = document.getElementById('search-username');
        const username = usernameInput.value.trim();
        
        if (!username) {
            this.showNotification('Please enter a username.', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/start-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    myEmail: this.userEmail,
                    targetUsername: username
                })
            });

            const data = await response.json();
            
            if (data.chat) {
                // Add to chats list if not already there
                const existingChat = this.chats.find(c => c.id === data.chat.id);
                if (!existingChat) {
                    this.chats.unshift(data.chat);
                    this.renderChatList();
                }
                
                // Select the chat
                this.selectChat(data.chat.id);
                usernameInput.value = '';
                
                this.showNotification(`Started chat with ${username}!`, 'success');
            } else {
                this.showNotification(data.message || 'User not found.', 'error');
            }
        } catch (error) {
            console.error('Failed to start chat:', error);
            this.showNotification('Failed to start chat.', 'error');
        }
    }

    focusSearchInput() {
        document.getElementById('search-username')?.focus();
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file || !this.currentChatId) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('chatId', this.currentChatId);
        formData.append('sender', this.userEmail);

        try {
            const response = await fetch(`${this.API_BASE}/upload-file`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.fileUrl) {
                const message = {
                    chatId: this.currentChatId,
                    fileUrl: data.fileUrl,
                    fileName: file.name,
                    sender: this.userEmail,
                    timestamp: new Date().toISOString()
                };

                // Send via WebSocket
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        type: 'file',
                        data: message
                    }));
                }

                // Add to UI
                const messageEl = this.createMessageElement(message);
                document.getElementById('messages').appendChild(messageEl);
                document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

                this.showNotification('File uploaded successfully!', 'success');
            } else {
                this.showNotification('Failed to upload file.', 'error');
            }
        } catch (error) {
            console.error('File upload failed:', error);
            this.showNotification('File upload failed.', 'error');
        }

        // Reset file input
        e.target.value = '';
    }

    startVideoCall() {
        this.showNotification('Video calling feature coming soon!', 'info');
    }

    startVoiceCall() {
        this.showNotification('Voice calling feature coming soon!', 'info');
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'message':
            case 'file':
                if (data.data.chatId === this.currentChatId) {
                    const messageEl = this.createMessageElement(data.data);
                    document.getElementById('messages').appendChild(messageEl);
                    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
                }
                // Update chat list
                this.loadChats();
                break;
            case 'chat_created':
                this.loadChats();
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    logout() {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('user');
        
        if (this.socket) {
            this.socket.close();
        }
        
        window.location.href = 'index.html';
    }

    formatTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        
        return date.toLocaleDateString();
    }

    showLoadingOverlay() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoadingOverlay() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add notification styles
        this.addNotificationStyles();

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    addNotificationStyles() {
        if (document.querySelector('#notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                border-left: 4px solid var(--primary-color);
                animation: slideInRight 0.3s ease-out;
            }
            
            .notification-success {
                border-left-color: var(--success-color);
            }
            
            .notification-error {
                border-left-color: var(--error-color);
            }
            
            .notification-warning {
                border-left-color: var(--warning-color);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
            }
            
            .notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                color: var(--text-primary);
                font-weight: 500;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--text-muted);
                cursor: pointer;
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .notification-close:hover {
                background: var(--bg-secondary);
                color: var(--text-primary);
            }
            
            .empty-state {
                text-align: center;
                padding: 2rem 1rem;
                color: var(--text-secondary);
                list-style: none;
            }
            
            .empty-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            
            .empty-state p {
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            
            .empty-state small {
                opacity: 0.7;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FlowSecDashboard();
});

async function encryptMessage(chatId, text) {
    const key = await getChatKey(chatId);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
    return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(ciphertext)));
}

async function decryptMessage(chatId, encrypted) {
    const key = await getChatKey(chatId);
    const data = atob(encrypted);
    const iv = Uint8Array.from(data.slice(0, 12), c => c.charCodeAt(0));
    const ct = Uint8Array.from(data.slice(12), c => c.charCodeAt(0));
    const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(dec);
}

async function fetchChats() {
    const res = await fetch(`${API_BASE}/chats?email=${encodeURIComponent(userEmail)}`);
    const data = await res.json();
    chats = data.chats;
    renderChatList();
}

async function fetchMessages(chatId) {
    const res = await fetch(`${API_BASE}/messages?chatId=${chatId}`);
    const data = await res.json();
    return data.messages;
}

async function renderChatList() {
    chatList.innerHTML = '';
    for (const chat of chats) {
        const li = document.createElement('li');
        const otherEmails = chat.users.filter(u => u !== userEmail);
        let display = '';
        if (otherEmails.length === 1) {
            // Fetch username and icon for the other user
            const res = await fetch(`${API_BASE}/user?email=${encodeURIComponent(otherEmails[0])}`);
            if (res.status === 200) {
                const data = await res.json();
                const icon = data.user.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.username)}`;
                display = `<img src="${icon}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;object-fit:cover;"> <span style="vertical-align:middle;">${data.user.username}</span>`;
            } else {
                display = otherEmails[0];
            }
        } else {
            display = otherEmails.join(', ') || myUsername;
        }
        li.innerHTML = display;
        li.className = chat._id === currentChatId ? 'selected' : '';
        li.onclick = () => selectChat(chat._id);
        chatList.appendChild(li);
        chatUsers[chat._id] = chat.users;
    }
}

async function renderMessages() {
    messagesDiv.innerHTML = '';
    if (!currentChatId) return;
    const msgs = await fetchMessages(currentChatId);
    for (const msg of msgs) {
        const div = document.createElement('div');
        div.className = 'message' + (msg.sender === userEmail ? ' me' : '');
        let text = '';
        try {
            text = await decryptMessage(currentChatId, msg.encrypted);
        } catch {
            text = '[Encrypted]';
        }
        if (msg.file && msg.file.filename) {
            div.innerHTML = `<span>${msg.sender === userEmail ? 'You sent a file:' : 'File received:'}</span><br><a class="file-link" href="http://localhost:5000/api/files/${msg.file.filename}" download>${msg.file.originalname}</a><br>${text}`;
        } else {
            div.textContent = text;
        }
        messagesDiv.appendChild(div);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function selectChat(id) {
    currentChatId = id;
    const chat = chats.find(c => c._id === id);
    const otherUsers = chat ? chat.users.filter(u => u !== userEmail) : [];
    chatTitle.textContent = otherUsers.join(', ') || userEmail;
    renderChatList();
    await renderMessages();
}

messageForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentChatId) return;
    const text = messageInput.value;
    const encrypted = await encryptMessage(currentChatId, text);
    await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId, sender: userEmail, encrypted })
    });
    messageInput.value = '';
    await renderMessages();
});

fileInput.addEventListener('change', async e => {
    if (!currentChatId || !fileInput.files.length) return;
    const file = fileInput.files[0];
    const text = prompt('Add a message (optional):') || '';
    const encrypted = await encryptMessage(currentChatId, text);
    const formData = new FormData();
    formData.append('chatId', currentChatId);
    formData.append('sender', userEmail);
    formData.append('encrypted', encrypted);
    formData.append('file', file);
    await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        body: formData
    });
    fileInput.value = '';
    await renderMessages();
});



// Start chat by searching username
document.getElementById('search-username-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const username = document.getElementById('search-username').value.trim();
    if (!username || username === myUsername) return;
    const res = await fetch(`${API_BASE}/user-by-username?username=${encodeURIComponent(username)}`);
    if (res.status !== 200) {
        alert('User not found');
        return;
    }
    const data = await res.json();
    const otherEmail = data.user.email;
    // Create chat if not exists
    await fetch(`${API_BASE}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: [userEmail, otherEmail] })
    });
    await fetchChats();
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('userEmail');
    window.location.href = 'index.html';
});



// Initial load
fetchMyProfile();
fetchChats().then(() => {
    if (chats.length) selectChat(chats[0]._id);
});
