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
        this.lastMessageCount = 0; // Track message count for smart polling
        this.currentMessages = []; // Cache current messages
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        // Only enable demo mode if there's no network connection
        this.checkNetworkAndInitialize();
        await this.loadUserProfile();
        this.bindEvents();
        this.loadChats();
        this.setupMobileMenu();
        
        // Start polling for new messages every 2 seconds
        this.startMessagePolling();
    }

    startMessagePolling() {
        // Poll for new messages every 2 seconds with smart updates
        setInterval(() => {
            if (this.currentChatId) {
                this.checkForNewMessages();
            }
        }, 2000);
    }

    async checkForNewMessages() {
        try {
            const response = await fetch(`${this.API_BASE}/messages?chatId=${this.currentChatId}`);
            if (response.ok) {
                const data = await response.json();
                const newMessages = data.messages || [];
                
                // Only update if there are new messages
                if (newMessages.length > this.currentMessages.length) {
                    const messagesToAdd = newMessages.slice(this.currentMessages.length);
                    this.addNewMessagesToUI(messagesToAdd);
                    this.currentMessages = newMessages;
                }
            }
        } catch (error) {
            // Silently handle errors to avoid disrupting the UI
            console.log('Background message check failed:', error);
        }
    }

    addNewMessagesToUI(newMessages) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer || newMessages.length === 0) return;

        // Check if user is at the bottom before adding messages
        const wasAtBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 10;

        // Add each new message without redrawing existing ones
        newMessages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            messagesContainer.appendChild(messageEl);
        });

        // Only auto-scroll if user was already at the bottom
        if (wasAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async checkNetworkAndInitialize() {
        try {
            // Test network connection to backend
            const response = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(this.userEmail)}`);
            if (response.ok) {
                // Network is available, use real data
                console.log('Network available - using real data');
                this.hideLoadingOverlay();
            } else {
                throw new Error('Backend not responding');
            }
        } catch (error) {
            console.log('Network error, enabling demo mode:', error);
            this.enableDemoMode();
            this.hideLoadingOverlay();
        }
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
        // Currently disabled - WebSocket server not implemented yet
        console.log('WebSocket connection disabled - not implemented yet');
        this.hideLoadingOverlay();
        return;
    }

    async loadUserProfile() {
        try {
            // First, try to get user data from localStorage
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (storedUser.username && storedUser.email) {
                // Use stored user data
                this.myUsername = storedUser.username;
                this.myProfileIcon = storedUser.profileIcon;
                this.userEmail = storedUser.email;
            } else {
                // Fallback: fetch from API
                const response = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(this.userEmail)}`);
                if (response.ok) {
                    const data = await response.json();
                    this.myUsername = data.user.username;
                    this.myProfileIcon = data.user.profileIcon;
                    // Update localStorage
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    throw new Error('Failed to fetch user data');
                }
            }
            
            // Update UI
            document.getElementById('my-username').textContent = this.myUsername;
            
            const profileImg = document.getElementById('my-profile-icon');
            if (this.myProfileIcon) {
                profileImg.src = `${this.API_BASE.replace('/api', '')}/uploads/${this.myProfileIcon}`;
                profileImg.style.display = 'block';
                profileImg.nextElementSibling.style.display = 'none';
            } else {
                profileImg.style.display = 'none';
                profileImg.nextElementSibling.style.display = 'flex';
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            // Fallback to demo data if network fails
            this.myUsername = 'DemoUser';
            this.myProfileIcon = null;
            document.getElementById('my-username').textContent = this.myUsername;
            this.showNotification('Failed to load profile information. Using demo data.', 'warning');
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
            // Load real chats from API
            const response = await fetch(`${this.API_BASE}/chats?email=${encodeURIComponent(this.userEmail)}`);
            if (response.ok) {
                const data = await response.json();
                this.chats = data.chats || [];
                
                // Format chats for display
                this.chats = await Promise.all(this.chats.map(async (chat) => {
                    // Get the other user's info for display name
                    const otherUserEmail = chat.users.find(email => email !== this.userEmail);
                    let displayName = otherUserEmail;
                    
                    try {
                        const userResponse = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(otherUserEmail)}`);
                        if (userResponse.ok) {
                            const userData = await userResponse.json();
                            displayName = userData.user.username;
                        }
                    } catch (error) {
                        console.log('Could not fetch user data for:', otherUserEmail);
                    }
                    
                    return {
                        ...chat,
                        name: displayName,
                        lastMessage: 'Start your conversation...',
                        unreadCount: 0
                    };
                }));
            }
            this.renderChatList();
        } catch (error) {
            console.error('Failed to load chats:', error);
            // Fall back to demo data on error
            this.enableDemoMode();
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

        // Reset message cache when switching chats
        this.currentMessages = [];

        // Update UI
        this.updateChatHeader(chat);
        this.renderChatList(); // Re-render to update active state
        await this.loadMessages(chatId); // Load real messages

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

    async loadMessages(chatId, silent = false) {
        try {
            const response = await fetch(`${this.API_BASE}/messages?chatId=${chatId}`);
            const data = await response.json();
            
            if (data.messages) {
                this.currentMessages = data.messages; // Cache messages
                this.renderMessages(data.messages, silent);
            }
        } catch (error) {
            if (!silent) {
                console.error('Failed to load messages:', error);
                this.showNotification('Failed to load messages.', 'error');
            }
        }
    }

    renderMessages(messages, silent = false) {
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

    updateChatLastMessage(chatId, message) {
        // Update the chat in the list with the latest message
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
            this.chats[chatIndex].lastMessage = message;
            this.chats[chatIndex].updatedAt = new Date().toISOString();
            this.renderChatList();
        }
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isMe = message.sender === this.userEmail;
        
        messageDiv.className = `message ${isMe ? 'sent' : 'received'}`;
        
        // Handle different content types
        let content;
        if (message.file) {
            // Handle file messages
            const fileUrl = `${this.API_BASE.replace('/api', '')}/uploads/${message.file.filename}`;
            content = `<a href="${fileUrl}" target="_blank" class="file-link">📎 ${message.file.originalname || 'File'}</a>`;
        } else {
            // Handle text messages - use encrypted field from database
            content = message.encrypted || message.content || '';
        }

        // Format timestamp
        const timestamp = message.createdAt || message.timestamp || new Date().toISOString();

        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${content}
            </div>
            <div class="message-time">${this.formatTime(new Date(timestamp))}</div>
        `;

        return messageDiv;
    }

    async sendMessage(e) {
        e.preventDefault();
        
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChatId) return;

        try {
            // Send message to server
            const response = await fetch(`${this.API_BASE}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: this.currentChatId,
                    sender: this.userEmail,
                    encrypted: content // For now, we'll send as plain text (encrypted in real implementation)
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                // Create message object
                const message = {
                    _id: data.message._id,
                    chatId: this.currentChatId,
                    sender: this.userEmail,
                    encrypted: content,
                    createdAt: data.message.createdAt || new Date().toISOString()
                };

                // Add to local cache
                this.currentMessages.push(message);

                // Add to UI immediately
                const messageEl = this.createMessageElement(message);
                document.getElementById('messages').appendChild(messageEl);
                document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

                // Clear input
                messageInput.value = '';

                // Update chat list with latest message
                this.updateChatLastMessage(this.currentChatId, content);
            } else {
                throw new Error('Failed to send message');
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message. Please try again.', 'error');
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
                const existingChat = this.chats.find(c => c._id === data.chat._id);
                if (!existingChat) {
                    // Format chat for display
                    const formattedChat = {
                        _id: data.chat._id,
                        users: data.chat.users,
                        name: username, // Display name as the target username
                        lastMessage: 'Start your conversation...',
                        unreadCount: 0,
                        updatedAt: data.chat.updatedAt || new Date().toISOString()
                    };
                    this.chats.unshift(formattedChat);
                    this.renderChatList();
                }
                
                // Select the chat
                this.selectChat(data.chat._id);
                usernameInput.value = '';
                
                this.showNotification(`Started chat with ${username}!`, 'success');
            } else {
                this.showNotification(data.message || 'User not found.', 'error');
            }
        } catch (error) {
            console.error('Failed to start chat:', error);
            this.showNotification('Failed to start chat. Please try again.', 'error');
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
