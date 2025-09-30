// FlowSec Vault Script
class FlowSecVault {
    constructor() {
        this.API_BASE = 'http://localhost:5000/api';
        this.currentTab = 'files';
        this.files = [];
        this.links = [];
        this.scans = [];
        this.userEmail = null;
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.enableDemoMode();
        await this.loadUserProfile();
        this.bindEvents();
        this.switchTab('files');
        this.startAutoRefresh();
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
        // Demo scanned files
        this.files = [
            {
                _id: 'file1',
                originalName: 'document.pdf',
                filename: 'doc123.pdf',
                fileType: 'application/pdf',
                fileSize: 1024576,
                scanStatus: 'safe',
                scanDate: new Date().toISOString(),
                scanResults: {
                    engines: { total: 67, positives: 0 },
                    threats: []
                }
            },
            {
                _id: 'file2',
                originalName: 'suspicious.exe',
                filename: 'sus456.exe',
                fileType: 'application/exe',
                fileSize: 2048000,
                scanStatus: 'malicious',
                scanDate: new Date(Date.now() - 3600000).toISOString(),
                scanResults: {
                    engines: { total: 67, positives: 15 },
                    threats: [
                        { engine: 'Microsoft', name: 'Trojan.Generic', level: 'high' },
                        { engine: 'Kaspersky', name: 'HEUR.Backdoor', level: 'high' }
                    ]
                }
            }
        ];

        // Demo scanned links
        this.links = [
            {
                _id: 'link1',
                url: 'https://example.com/safe-page',
                domain: 'example.com',
                scanStatus: 'safe',
                scanDate: new Date().toISOString(),
                scanResults: {
                    engines: { total: 89, positives: 0 },
                    threats: []
                }
            },
            {
                _id: 'link2',
                url: 'https://suspicious-site.bad/malware',
                domain: 'suspicious-site.bad',
                scanStatus: 'malicious',
                scanDate: new Date(Date.now() - 1800000).toISOString(),
                scanResults: {
                    engines: { total: 89, positives: 23 },
                    threats: [
                        { engine: 'Google', name: 'Phishing', level: 'high' },
                        { engine: 'Fortinet', name: 'Malware', level: 'medium' }
                    ]
                }
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

    async loadUserProfile() {
        try {
            const response = await fetch(`${this.API_BASE}/user?email=${encodeURIComponent(this.userEmail)}`);
            const data = await response.json();
            
            if (data.user) {
                document.getElementById('my-username').textContent = data.user.username;
                
                const profileImg = document.getElementById('my-profile-icon');
                if (data.user.profileIcon) {
                    profileImg.src = data.user.profileIcon;
                    profileImg.style.display = 'block';
                    profileImg.nextElementSibling.style.display = 'none';
                } else {
                    profileImg.style.display = 'none';
                    profileImg.nextElementSibling.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Refresh buttons
        document.getElementById('refresh-files')?.addEventListener('click', () => this.loadFiles());
        document.getElementById('refresh-links')?.addEventListener('click', () => this.loadLinks());

        // Filters
        document.getElementById('file-filter')?.addEventListener('change', (e) => this.filterFiles(e.target.value));
        document.getElementById('link-filter')?.addEventListener('change', (e) => this.filterLinks(e.target.value));

        // Full scan button
        document.getElementById('run-full-scan')?.addEventListener('click', () => this.runFullScan());

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Mobile menu
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            document.querySelector('.main-content')?.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}-panel`).classList.add('active');

        // Load data for the selected tab
        switch (tabName) {
            case 'files':
                this.loadFiles();
                break;
            case 'links':
                this.loadLinks();
                break;
            case 'scans':
                this.loadScanHistory();
                break;
        }
    }

    async loadFiles() {
        try {
            this.showLoadingOverlay();
            // Use demo data in offline mode
            if (this.files && this.files.length > 0) {
                this.renderFilesTable();
                this.updateStats();
            } else {
                this.showEmptyState('files');
            }
        } catch (error) {
            console.error('Failed to load files:', error);
            this.showNotification('Failed to load files data.', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async loadLinks() {
        try {
            this.showLoadingOverlay();
            // Use demo data in offline mode
            if (this.links && this.links.length > 0) {
                this.renderLinksTable();
            } else {
                this.showEmptyState('links');
            }
        } catch (error) {
            console.error('Failed to load links:', error);
            this.showNotification('Failed to load links data.', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async loadScanHistory() {
        try {
            this.showLoadingOverlay();
            const response = await fetch(`${this.API_BASE}/vault/stats?userId=${encodeURIComponent(this.userEmail)}`);
            const data = await response.json();
            
            if (data.files || data.links) {
                this.scans = data.scans;
                this.renderScanTimeline();
            }
        } catch (error) {
            console.error('Failed to load scan history:', error);
            this.showNotification('Failed to load scan history.', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    renderFilesTable(files = this.files) {
        const tbody = document.getElementById('files-table-body');
        const emptyState = document.getElementById('files-empty');

        if (files.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        tbody.innerHTML = files.map(file => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="file-icon">${this.getFileIcon(file.name)}</div>
                        <span>${file.name}</span>
                    </div>
                </td>
                <td>${file.recipient}</td>
                <td>${this.formatDate(file.dateSent)}</td>
                <td>
                    <div class="file-hash" title="${file.hash || 'Not available'}">${file.hash || '-'}</div>
                </td>
                <td>
                    <div class="status-badge ${file.status}">
                        <div class="status-icon ${file.status}"></div>
                        ${this.getStatusText(file.status)}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-small" onclick="vaultInstance.showFileDetails('${file.id}')">Details</button>
                        ${file.status === 'malicious' ? 
                            '<button class="action-btn-small danger" onclick="vaultInstance.quarantineFile(\''+file.id+'\')">Quarantine</button>' : 
                            '<button class="action-btn-small" onclick="vaultInstance.rescanFile(\''+file.id+'\')">Rescan</button>'
                        }
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderLinksTable(links = this.links) {
        const tbody = document.getElementById('links-table-body');
        const emptyState = document.getElementById('links-empty');

        if (links.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        tbody.innerHTML = links.map(link => `
            <tr>
                <td>
                    <div class="link-display">
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.url}</a>
                    </div>
                </td>
                <td>${link.recipient}</td>
                <td>${this.formatDate(link.dateSent)}</td>
                <td>${this.getDomain(link.url)}</td>
                <td>
                    <div class="status-badge ${link.status}">
                        <div class="status-icon ${link.status}"></div>
                        ${this.getStatusText(link.status)}
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-small" onclick="vaultInstance.showLinkDetails('${link.id}')">Details</button>
                        ${link.status === 'malicious' ? 
                            '<button class="action-btn-small danger" onclick="vaultInstance.blockDomain(\''+this.getDomain(link.url)+'\')">Block Domain</button>' : 
                            '<button class="action-btn-small" onclick="vaultInstance.rescanLink(\''+link.id+'\')">Rescan</button>'
                        }
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderScanTimeline() {
        const timeline = document.getElementById('scan-timeline');
        
        if (this.scans.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No Scan History</h3>
                    <p>Security scans will appear here once files and links are analyzed.</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = this.scans.map(scan => `
            <div class="timeline-item">
                <div class="timeline-icon ${scan.result}">
                    ${this.getScanIcon(scan.type, scan.result)}
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${scan.title}</div>
                    <div class="timeline-description">${scan.description}</div>
                    <div class="timeline-meta">
                        <span>📅 ${this.formatDate(scan.timestamp)}</span>
                        <span>⏱️ ${scan.duration}</span>
                        <span>🎯 ${scan.itemsScanned} items</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterFiles(status) {
        if (status === 'all') {
            this.renderFilesTable();
        } else {
            const filtered = this.files.filter(file => file.status === status);
            this.renderFilesTable(filtered);
        }
    }

    filterLinks(status) {
        if (status === 'all') {
            this.renderLinksTable();
        } else {
            const filtered = this.links.filter(link => link.status === status);
            this.renderLinksTable(filtered);
        }
    }

    updateStats() {
        const totalFiles = this.files.length;
        const safeFiles = this.files.filter(f => f.status === 'safe').length;
        const pendingFiles = this.files.filter(f => f.status === 'scanning').length;
        const threatFiles = this.files.filter(f => f.status === 'malicious').length;

        document.getElementById('total-files').textContent = totalFiles;
        document.getElementById('safe-files').textContent = safeFiles;
        document.getElementById('pending-files').textContent = pendingFiles;
        document.getElementById('threat-files').textContent = threatFiles;
    }

    async showFileDetails(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const modalContent = document.getElementById('file-details-content');
        modalContent.innerHTML = `
            <div class="file-details">
                <h4>${file.name}</h4>
                <div class="details-grid">
                    <div class="detail-item">
                        <label>File Size:</label>
                        <span>${this.formatFileSize(file.size)}</span>
                    </div>
                    <div class="detail-item">
                        <label>File Type:</label>
                        <span>${file.type}</span>
                    </div>
                    <div class="detail-item">
                        <label>SHA256 Hash:</label>
                        <span class="file-hash">${file.hash || 'Not available'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Scan Date:</label>
                        <span>${this.formatDate(file.scanDate)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Status:</label>
                        <div class="status-badge ${file.status}">
                            <div class="status-icon ${file.status}"></div>
                            ${this.getStatusText(file.status)}
                        </div>
                    </div>
                    ${file.threats ? `
                        <div class="detail-item full-width">
                            <label>Detected Threats:</label>
                            <div class="threats-list">
                                ${file.threats.map(threat => `
                                    <div class="threat-item">
                                        <strong>${threat.name}</strong>
                                        <span class="threat-level ${threat.level}">${threat.level}</span>
                                        <p>${threat.description}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        this.showModal('file-details-modal');
    }

    async runFullScan() {
        try {
            this.showLoadingOverlay();
            this.showNotification('Starting full security scan...', 'info');

            const response = await fetch(`${this.API_BASE}/vault/full-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.userEmail })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Full scan initiated successfully!', 'success');
                // Refresh all data
                await this.loadFiles();
                await this.loadLinks();
                await this.loadScanHistory();
            } else {
                this.showNotification(data.message || 'Failed to start scan.', 'error');
            }
        } catch (error) {
            console.error('Full scan failed:', error);
            this.showNotification('Failed to start full scan.', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async rescanFile(fileId) {
        try {
            const response = await fetch(`${this.API_BASE}/vault/rescan-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, email: this.userEmail })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('File rescan initiated.', 'success');
                await this.loadFiles();
            } else {
                this.showNotification('Failed to rescan file.', 'error');
            }
        } catch (error) {
            console.error('Rescan failed:', error);
            this.showNotification('Rescan request failed.', 'error');
        }
    }

    async quarantineFile(fileId) {
        if (!confirm('Are you sure you want to quarantine this file? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/vault/quarantine-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, email: this.userEmail })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showNotification('File quarantined successfully.', 'success');
                await this.loadFiles();
            } else {
                this.showNotification('Failed to quarantine file.', 'error');
            }
        } catch (error) {
            console.error('Quarantine failed:', error);
            this.showNotification('Quarantine request failed.', 'error');
        }
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.currentTab === 'files') {
                this.loadFiles();
            } else if (this.currentTab === 'links') {
                this.loadLinks();
            }
        }, 30000);
    }

    showEmptyState(type) {
        const emptyElement = document.getElementById(`${type}-empty`);
        const tbody = document.getElementById(`${type}-table-body`);
        if (emptyElement && tbody) {
            tbody.innerHTML = '';
            emptyElement.style.display = 'block';
        }
    }

    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const icons = {
            pdf: '📄', doc: '📝', docx: '📝', txt: '📄',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
            mp4: '🎥', avi: '🎥', mov: '🎥',
            mp3: '🎵', wav: '🎵', flac: '🎵',
            zip: '📦', rar: '📦', '7z': '📦',
            exe: '⚙️', msi: '⚙️', app: '⚙️'
        };
        return icons[ext] || '📁';
    }

    getStatusText(status) {
        const statusMap = {
            safe: 'Safe',
            scanning: 'Scanning',
            malicious: 'Threat Detected',
            pending: 'Pending'
        };
        return statusMap[status] || status;
    }

    getScanIcon(type, result) {
        if (result === 'success') return '✅';
        if (result === 'warning') return '⚠️';
        if (result === 'error') return '❌';
        return '🔍';
    }

    getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'Unknown';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
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

        this.addNotificationStyles();
        document.body.appendChild(notification);

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
            
            .notification-success { border-left-color: var(--success-color); }
            .notification-error { border-left-color: var(--error-color); }
            .notification-warning { border-left-color: var(--warning-color); }
            
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
            
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(styles);
    }

    logout() {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('user');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        window.location.href = 'index.html';
    }
}

// Global functions for onclick handlers
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Initialize the vault when the page loads
let vaultInstance;
document.addEventListener('DOMContentLoaded', () => {
    vaultInstance = new FlowSecVault();
});
