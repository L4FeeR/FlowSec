// Encrypted File Sharing JavaScript for FlowSec-f4
console.log('file-share.js loaded');

class EncryptedFileSharing {
    constructor() {
        console.log('EncryptedFileSharing constructor called');
        this.API_BASE = 'http://localhost:5000/api';
        
        // Auto-setup demo mode if no user exists
        if (!localStorage.getItem('userEmail')) {
            this.setupDemoMode();
        }
        
        this.userEmail = localStorage.getItem('userEmail');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.selectedFriend = null;
        this.friends = [];
        this.keyPair = null;
        this.currentTab = 'shared';
        
        this.init();
    }

    setupDemoMode() {
        // Set demo user data
        localStorage.setItem('userEmail', 'demo@flowsec.com');
        localStorage.setItem('user', JSON.stringify({
            email: 'demo@flowsec.com',
            username: 'DemoUser',
            profileIcon: null
        }));
        console.log('Demo mode enabled');
    }

    async init() {
        console.log('init() called, userEmail:', this.userEmail);
        
        // Create debug display
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-info';
        debugDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:#000;color:#fff;padding:10px;z-index:9999;font-family:monospace;font-size:12px;max-width:300px;';
        debugDiv.innerHTML = `UserEmail: ${this.userEmail || 'NULL'}<br>Starting loadUserData...`;
        document.body.appendChild(debugDiv);
        
        // Add to debug
        this.debugDiv = debugDiv;
        
        if (!this.userEmail) {
            console.log('No userEmail, redirecting to index.html');
            debugDiv.innerHTML += '<br>No userEmail - redirecting...';
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        this.setupEventListeners();
        await this.loadUserData();
        await this.checkEncryptionKeys();
        await this.loadFriends();
        await this.loadFiles();
    }

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const uploadArea = document.getElementById('upload-area');

        browseBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => this.handleFileSelection(e));

        // Drag and drop
        uploadArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea?.addEventListener('drop', (e) => this.handleDrop(e));
        uploadArea?.addEventListener('dragleave', (e) => this.handleDragLeave(e));

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Add friend
        document.getElementById('add-friend-btn')?.addEventListener('click', () => this.showAddFriendModal());
        document.getElementById('search-user-btn')?.addEventListener('click', () => this.searchUsers());

        // Key generation
        document.getElementById('generate-keys-btn')?.addEventListener('click', () => this.generateEncryptionKeys());

        // Search friends
        document.getElementById('search-friends')?.addEventListener('input', (e) => this.searchFriends(e.target.value));
    }

    async loadUserData() {
        try {
            if (this.debugDiv) this.debugDiv.innerHTML += '<br>Making API call to /user...';
            const res = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(this.userEmail)}`);
            
            if (this.debugDiv) this.debugDiv.innerHTML += `<br>API Response Status: ${res.status}`;
            if (res.ok) {
                const data = await res.json();
                this.user = data.user;
            } else if (res.status === 404) {
                // User doesn't exist, create it
                await this.createDemoUser();
                return this.loadUserData(); // Retry after creating user
            } else {
                throw new Error('Failed to fetch user data');
            }
            
            
            // Update UI
            document.getElementById('user-name').textContent = this.user.username;
            document.getElementById('user-email').textContent = this.user.email;
            document.getElementById('files-count').textContent = this.user.stats?.files || 0;
            document.getElementById('friends-count').textContent = this.user.stats?.friends || 0;

            // Set avatar
            const avatar = document.getElementById('user-avatar');
            if (avatar) {
                avatar.textContent = this.user.username.charAt(0).toUpperCase();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Failed to load user data', 'error');
        }
    }

    async createDemoUser() {
        try {
            const createRes = await fetch(`${this.API_BASE}/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.userEmail,
                    username: this.userEmail === 'demo@flowsec.com' ? 'DemoUser' : 'User',
                    profileIcon: '',
                    publicKey: ''
                })
            });

            if (!createRes.ok) {
                const errorData = await createRes.json();
                throw new Error(errorData.message || 'Failed to create user');
            }
            
            console.log('Demo user created successfully');
        } catch (error) {
            console.error('Error creating demo user:', error);
            throw error;
        }
    }

    async checkEncryptionKeys() {
        // Check if user has public key
        if (!this.user.publicKey) {
            this.showKeyGenerationModal();
            return false;
        }
        
        // Try to load private key from localStorage
        const privateKeyData = localStorage.getItem('privateKey');
        if (!privateKeyData) {
            this.showKeyGenerationModal();
            return false;
        }

        try {
            // Import the stored private key
            const privateKeyBuffer = Uint8Array.from(atob(privateKeyData), c => c.charCodeAt(0));
            const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                privateKeyBuffer,
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['decrypt']
            );

            // Import public key
            const publicKeyBuffer = Uint8Array.from(atob(this.user.publicKey), c => c.charCodeAt(0));
            const publicKey = await crypto.subtle.importKey(
                'spki',
                publicKeyBuffer,
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['encrypt']
            );

            this.keyPair = { privateKey, publicKey };
            return true;
        } catch (error) {
            console.error('Error importing keys:', error);
            this.showKeyGenerationModal();
            return false;
        }
    }

    async generateEncryptionKeys() {
        try {
            document.getElementById('key-gen-progress').style.display = 'block';
            document.getElementById('generate-keys-btn').disabled = true;

            // Generate RSA key pair
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: 'SHA-256'
                },
                true,
                ['encrypt', 'decrypt']
            );

            // Export keys
            const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
            const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

            // Convert to base64
            const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
            const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

            // Store private key locally
            localStorage.setItem('privateKey', privateKeyBase64);

            // Update user's public key on server
            const updateRes = await fetch(`${this.API_BASE}/update-public-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.userEmail,
                    publicKey: publicKeyBase64
                })
            });

            if (updateRes.ok) {
                const data = await updateRes.json();
                this.keyPair = keyPair;
                this.user.publicKey = publicKeyBase64;
                this.closeKeyGenModal();
                this.showNotification('Encryption keys generated successfully!', 'success');
            } else {
                const errorData = await updateRes.json();
                throw new Error(errorData.message || 'Failed to update public key on server');
            }
        } catch (error) {
            console.error('Error generating keys:', error);
            this.showNotification('Failed to generate encryption keys', 'error');
        } finally {
            document.getElementById('key-gen-progress').style.display = 'none';
            document.getElementById('generate-keys-btn').disabled = false;
        }
    }

    async loadFriends() {
        try {
            const res = await fetch(`${this.API_BASE}/friends?email=${encodeURIComponent(this.userEmail)}`);
            if (!res.ok) throw new Error('Failed to fetch friends');
            
            const data = await res.json();
            this.friends = data.friends || [];
            console.log('Loaded friends:', this.friends);
            this.renderFriends();
        } catch (error) {
            console.error('Error loading friends:', error);
            document.getElementById('friends-list').innerHTML = 
                '<div class="empty-state"><h3>Error loading friends</h3></div>';
        }
    }

    renderFriends() {
        const friendsList = document.getElementById('friends-list');
        
        if (!this.friends.length) {
            friendsList.innerHTML = `
                <div class="empty-state">
                    <h3>No friends yet</h3>
                    <p>Add friends to start sharing encrypted files</p>
                </div>
            `;
            return;
        }

        friendsList.innerHTML = this.friends.map(friend => `
            <div class="friend-item" data-friend-id="${friend._id}" onclick="window.fileSharing.selectFriend('${friend._id}')">
                <div class="friend-avatar">${friend.username.charAt(0).toUpperCase()}</div>
                <div class="friend-details">
                    <h4>${friend.username}</h4>
                    <span>${friend.email}</span>
                </div>
            </div>
        `).join('');
    }

    selectFriend(friendId) {
        // Remove previous selection
        document.querySelectorAll('.friend-item').forEach(item => item.classList.remove('active'));
        
        // Select new friend
        const friendElement = document.querySelector(`[data-friend-id="${friendId}"]`);
        friendElement?.classList.add('active');
        
        this.selectedFriend = this.friends.find(f => f._id === friendId);
        
        console.log('Selected friend:', this.selectedFriend);
        
        if (this.selectedFriend) {
            document.getElementById('current-context-title').textContent = 
                `Sharing with ${this.selectedFriend.username}`;
            document.getElementById('current-friend-email').textContent = this.selectedFriend.email;
        }
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            this.uploadFiles(files);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            this.uploadFiles(files);
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('upload-area').classList.remove('dragover');
    }

    async uploadFiles(files) {
        if (!this.selectedFriend) {
            this.showNotification('Please select a friend to share files with', 'error');
            return;
        }

        if (!this.keyPair) {
            this.showNotification('Encryption keys not available. Please generate your encryption keys first.', 'error');
            this.showKeyGenModal();
            return;
        }

        // Check if friend has public key before starting upload
        try {
            const pubRes = await fetch(`${this.API_BASE}/public-key?email=${encodeURIComponent(this.selectedFriend.email)}`);
            if (!pubRes.ok) {
                if (pubRes.status === 404) {
                    this.showNotification(`${this.selectedFriend.email} hasn't set up encryption keys yet. Ask them to generate their keys first.`, 'error');
                } else {
                    this.showNotification('Could not verify friend\'s encryption keys', 'error');
                }
                return;
            }
        } catch (error) {
            this.showNotification('Network error while checking friend\'s keys', 'error');
            return;
        }

        const progressSection = document.getElementById('progress-section');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressStatus = document.getElementById('progress-status');

        progressSection.style.display = 'block';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progress = ((i + 1) / files.length) * 100;
            
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
            progressStatus.textContent = `Encrypting and uploading ${file.name}...`;

            try {
                await this.encryptAndShareFile(file);
                this.showNotification(`${file.name} shared successfully!`, 'success');
            } catch (error) {
                console.error(`Error sharing ${file.name}:`, error);
                this.showNotification(`Failed to share ${file.name}`, 'error');
            }
        }

        progressSection.style.display = 'none';
        await this.loadFiles(); // Refresh file lists
    }

    async encryptAndShareFile(file) {
        // Generate AES key for file encryption
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        // Encrypt the file
        const fileBuffer = await file.arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedFile = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            fileBuffer
        );

        // Get friend's public key
        console.log('Fetching public key for friend:', this.selectedFriend.email);
        const pubRes = await fetch(`${this.API_BASE}/public-key?email=${encodeURIComponent(this.selectedFriend.email)}`);
        if (!pubRes.ok) {
            let errorMessage = 'Could not fetch friend\'s public key';
            if (pubRes.status === 404) {
                errorMessage = `${this.selectedFriend.email} hasn't set up encryption keys yet. Ask them to visit the FlowSec file sharing page to generate their keys.`;
            }
            throw new Error(errorMessage);
        }
        const pubData = await pubRes.json();

        // Import friend's public key
        const friendPublicKey = await crypto.subtle.importKey(
            'spki',
            Uint8Array.from(atob(pubData.publicKey), c => c.charCodeAt(0)),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );

        // Encrypt AES key with friend's public key
        const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
        const encryptedAesKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            friendPublicKey,
            rawAesKey
        );

        // Prepare form data
        const formData = new FormData();
        formData.append('file', new Blob([encryptedFile]), file.name + '.enc');
        formData.append('email', this.userEmail);
        formData.append('friend', this.selectedFriend.email);
        formData.append('iv', btoa(String.fromCharCode(...iv)));
        formData.append('encryptedAesKey', btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))));

        // Upload encrypted file
        const res = await fetch(`${this.API_BASE}/share-file`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'File upload failed');
        }

        return res.json();
    }

    async loadFiles() {
        await Promise.all([
            this.loadSharedFiles(),
            this.loadUploadedFiles()
        ]);
    }

    async loadSharedFiles() {
        try {
            const res = await fetch(`${this.API_BASE}/shared-files?email=${encodeURIComponent(this.userEmail)}`);
            if (!res.ok) throw new Error('Failed to fetch shared files');
            
            const data = await res.json();
            this.renderSharedFiles(data.files || []);
        } catch (error) {
            console.error('Error loading shared files:', error);
            document.getElementById('shared-files-list').innerHTML = 
                '<div class="empty-state"><h3>Error loading shared files</h3></div>';
        }
    }

    async loadUploadedFiles() {
        try {
            const res = await fetch(`${this.API_BASE}/list-files?email=${encodeURIComponent(this.userEmail)}`);
            if (!res.ok) throw new Error('Failed to fetch uploaded files');
            
            const data = await res.json();
            this.renderUploadedFiles(data.files || []);
        } catch (error) {
            console.error('Error loading uploaded files:', error);
            document.getElementById('uploaded-files-list').innerHTML = 
                '<div class="empty-state"><h3>Error loading uploaded files</h3></div>';
        }
    }

    renderSharedFiles(files) {
        const container = document.getElementById('shared-files-list');
        
        if (!files.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No shared files</h3>
                    <p>Files shared with you will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-icon">${this.getFileIcon(file.mimetype)}</div>
                <div class="file-details">
                    <h4 class="file-name">${file.originalName}</h4>
                    <div class="file-meta">
                        <span>${this.formatFileSize(file.size)}</span>
                        <span>Shared by ${file.sharedWith}</span>
                        <span>${new Date(file.uploadedAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn primary" onclick="window.fileSharing.downloadAndDecryptFile('${file._id}', '${file.storedName}', '${file.originalName}', '${file.encryptedAESKey}', '${file.iv}')">
                        📥 Download
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderUploadedFiles(files) {
        const container = document.getElementById('uploaded-files-list');
        
        if (!files.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No uploaded files</h3>
                    <p>Files you share will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-icon">${this.getFileIcon(file.mimetype)}</div>
                <div class="file-details">
                    <h4 class="file-name">${file.originalName}</h4>
                    <div class="file-meta">
                        <span>${this.formatFileSize(file.size)}</span>
                        <span>${new Date(file.uploadedAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn" onclick="window.fileSharing.downloadFile('${file.storedName}', '${file.originalName}')">
                        📥 Download
                    </button>
                </div>
            </div>
        `).join('');
    }

    async downloadAndDecryptFile(fileId, storedName, originalName, encryptedAESKey, iv) {
        if (!this.keyPair) {
            this.showNotification('Decryption keys not available', 'error');
            return;
        }

        try {
            // Download encrypted file
            const fileRes = await fetch(`${this.API_BASE}/files/${storedName}`);
            if (!fileRes.ok) throw new Error('Failed to download file');
            
            const encryptedBuffer = await fileRes.arrayBuffer();

            // Decrypt AES key
            const encryptedKeyBuffer = Uint8Array.from(atob(encryptedAESKey), c => c.charCodeAt(0));
            const rawAesKey = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                this.keyPair.privateKey,
                encryptedKeyBuffer
            );

            // Import AES key
            const aesKey = await crypto.subtle.importKey(
                'raw',
                rawAesKey,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // Decrypt file
            const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBuffer },
                aesKey,
                encryptedBuffer
            );

            // Download decrypted file
            const blob = new Blob([decryptedBuffer]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = originalName;
            a.click();
            URL.revokeObjectURL(url);

            this.showNotification('File decrypted and downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error downloading/decrypting file:', error);
            this.showNotification('Failed to decrypt file', 'error');
        }
    }

    downloadFile(storedName, originalName) {
        const link = document.createElement('a');
        link.href = `${this.API_BASE}/files/${storedName}`;
        link.download = originalName;
        link.click();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === `${tabName}-files` ? 'block' : 'none';
        });
    }

    async searchUsers() {
        const query = document.getElementById('user-search').value.trim();
        if (!query) return;

        try {
            const res = await fetch(`${this.API_BASE}/search-users?query=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Search failed');
            
            const data = await res.json();
            this.renderSearchResults(data.users || []);
        } catch (error) {
            console.error('Error searching users:', error);
            this.showNotification('Failed to search users', 'error');
        }
    }

    renderSearchResults(users) {
        const container = document.getElementById('search-results');
        
        if (!users.length) {
            container.innerHTML = '<p>No users found</p>';
            return;
        }

        container.innerHTML = users.map(user => `
            <div class="user-result" onclick="window.fileSharing.addFriend('${user._id}')">
                <div class="result-avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="result-details">
                    <h4>${user.username}</h4>
                    <span>${user.email}</span>
                </div>
            </div>
        `).join('');
    }

    async addFriend(friendId) {
        try {
            const res = await fetch(`${this.API_BASE}/friends`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.user._id,
                    friendId: friendId
                })
            });

            if (!res.ok) throw new Error('Failed to add friend');
            
            const data = await res.json();
            this.showNotification(data.message, 'success');
            this.closeAddFriendModal();
            await this.loadFriends();
        } catch (error) {
            console.error('Error adding friend:', error);
            this.showNotification('Failed to add friend', 'error');
        }
    }

    searchFriends(query) {
        const friends = document.querySelectorAll('.friend-item');
        friends.forEach(friend => {
            const name = friend.querySelector('h4').textContent.toLowerCase();
            const email = friend.querySelector('span').textContent.toLowerCase();
            const matches = name.includes(query.toLowerCase()) || email.includes(query.toLowerCase());
            friend.style.display = matches ? 'flex' : 'none';
        });
    }

    getFileIcon(mimetype) {
        if (mimetype.startsWith('image/')) return '🖼️';
        if (mimetype.startsWith('video/')) return '🎥';
        if (mimetype.startsWith('audio/')) return '🎵';
        if (mimetype.includes('pdf')) return '📄';
        if (mimetype.includes('word') || mimetype.includes('doc')) return '📝';
        if (mimetype.includes('excel') || mimetype.includes('sheet')) return '📊';
        if (mimetype.includes('zip') || mimetype.includes('archive')) return '🗜️';
        return '📁';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showAddFriendModal() {
        document.getElementById('add-friend-modal').style.display = 'flex';
    }

    closeAddFriendModal() {
        document.getElementById('add-friend-modal').style.display = 'none';
        document.getElementById('user-search').value = '';
        document.getElementById('search-results').innerHTML = '';
    }

    showKeyGenerationModal() {
        document.getElementById('key-gen-modal').style.display = 'flex';
    }

    closeKeyGenModal() {
        document.getElementById('key-gen-modal').style.display = 'none';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Global functions for onclick handlers
window.logout = function() {
    localStorage.clear();
    window.location.href = 'index.html';
};

window.closeAddFriendModal = function() {
    window.fileSharing.closeAddFriendModal();
};

window.closeKeyGenModal = function() {
    window.fileSharing.closeKeyGenModal();
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing EncryptedFileSharing');
    window.fileSharing = new EncryptedFileSharing();
});

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        max-width: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid var(--primary-color);
        animation: slideInRight 0.3s ease-out;
    }
    
    .notification-success {
        border-left-color: #10b981;
    }
    
    .notification-error {
        border-left-color: #ef4444;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        gap: 12px;
    }
    
    .notification-message {
        flex: 1;
        color: var(--text-primary);
        font-size: 14px;
    }
    
    .notification button {
        background: none;
        border: none;
        font-size: 18px;
        color: var(--text-muted);
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
    }
    
    .notification button:hover {
        background: var(--bg-secondary);
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
document.head.appendChild(notificationStyles);
