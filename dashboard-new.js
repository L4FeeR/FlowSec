const API_BASE = 'http://localhost:5000/api';

// Global state
let userEmail = localStorage.getItem('userEmail');
let userId = localStorage.getItem('userId');
let username = localStorage.getItem('username');
let myProfileIcon = null;
let currentChatId = null;
let chats = [];
let chatUsers = {}; // chatId -> [user emails]

// Check if user is logged in
if (!userEmail) {
    window.location.href = 'index.html';
}

// Load user profile
async function loadUserProfile() {
    try {
        const res = await fetch(`${API_BASE}/user?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch user data');
        
        const data = await res.json();
        const user = data.user;

        // Update global state
        username = user.username;
        myProfileIcon = user.profileIcon;
        userId = user._id;

        // Store updated values
        localStorage.setItem('username', username);
        localStorage.setItem('userId', userId);

        // Update UI
        const dashboardUsername = document.getElementById('dashboard-username');
        const userId_elem = document.getElementById('user-id');
        const userEmail_elem = document.getElementById('user-email');
        
        if (dashboardUsername) dashboardUsername.textContent = username;
        if (userId_elem) userId_elem.textContent = `ID: ${userId}`;
        if (userEmail_elem) userEmail_elem.textContent = userEmail;

        // Set profile picture
        const profilePic = document.getElementById('profile-picture');
        if (profilePic) {
            profilePic.src = myProfileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
        }

        // Update stats
        const filesCount = document.getElementById('files-count');
        const friendsCount = document.getElementById('friends-count');
        
        if (filesCount && friendsCount) {
            filesCount.textContent = user.stats?.files || 0;
            friendsCount.textContent = user.stats?.friends || 0;
        }

        await fetchFriends();
        await fetchUserFiles();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        const dashboardUsername = document.getElementById('dashboard-username');
        if (dashboardUsername) {
            dashboardUsername.textContent = 'Error loading profile';
        }
    }
}

// Fetch friends
async function fetchFriends() {
    try {
        const res = await fetch(`${API_BASE}/friends?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        
        const data = await res.json();
        const friendsContainer = document.getElementById('friends-list');
        if (!friendsContainer) return;

        friendsContainer.innerHTML = `
            <div class="friends-header">
                <h3>Friends</h3>
                <button id="add-friend-btn" class="add-friend-button">
                    <span>+</span> Add Friend
                </button>
            </div>
            <div class="search-friend">
                <input type="text" id="search-friend-input" placeholder="Search friends...">
            </div>
            <ul class="friends-list" id="friend-list"></ul>
        `;

        const friendList = document.getElementById('friend-list');
        if (!friendList) return;

        if (data.friends && data.friends.length) {
            data.friends.forEach(friend => {
                const li = document.createElement('li');
                li.className = 'friend-item';
                const avatar = friend.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}`;
                li.innerHTML = `
                    <div class="friend-avatar">
                        <img src="${avatar}" alt="${friend.username}">
                    </div>
                    <div class="friend-info">
                        <h4>${friend.username}</h4>
                        <p>${friend.email}</p>
                    </div>
                    <div class="friend-actions">
                        <button class="chat-btn" data-friend-id="${friend._id}">Chat</button>
                        <button class="share-btn" data-friend-id="${friend._id}">Share</button>
                    </div>
                `;
                friendList.appendChild(li);

                // Add event listeners for chat and share buttons
                const chatBtn = li.querySelector('.chat-btn');
                const shareBtn = li.querySelector('.share-btn');

                if (chatBtn) {
                    chatBtn.addEventListener('click', () => startChat(friend._id));
                }
                if (shareBtn) {
                    shareBtn.addEventListener('click', () => shareFile(friend._id));
                }
            });
        } else {
            friendList.innerHTML = '<li class="no-friends">No friends yet. Add some friends to start sharing!</li>';
        }

        // Add event listener for add friend button
        const addFriendBtn = document.getElementById('add-friend-btn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', showAddFriendModal);
        }

        // Add event listener for friend search
        const searchInput = document.getElementById('search-friend-input');
        if (searchInput) {
            searchInput.addEventListener('input', handleFriendSearch);
        }

    } catch (error) {
        console.error('Error fetching friends:', error);
        const friendList = document.getElementById('friend-list');
        if (friendList) {
            friendList.innerHTML = '<li class="error">Error loading friends</li>';
        }
    }
}

// Fetch user files
async function fetchUserFiles() {
    const filesList = document.getElementById('files-list');
    if (!filesList) return;

    try {
        const res = await fetch(`${API_BASE}/list-files?userId=${userId}`);
        const data = await res.json();
        
        if (data.files && data.files.length) {
            filesList.innerHTML = data.files.map(file => `
                <div class="file-item">
                    <span class="file-name">${file.originalName}</span>
                    <div class="file-actions">
                        <button class="download-btn" data-file-id="${file._id}">Download</button>
                        <button class="share-btn" data-file-id="${file._id}">Share</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners for file actions
            filesList.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', () => downloadFile(btn.dataset.fileId));
            });
            filesList.querySelectorAll('.share-btn').forEach(btn => {
                btn.addEventListener('click', () => showShareModal(btn.dataset.fileId));
            });
        } else {
            filesList.innerHTML = '<p class="no-files">No files uploaded yet</p>';
        }
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = '<p class="error">Error loading files</p>';
    }
}

// Modal handlers
function showAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.style.display = 'block';
}

function closeAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.style.display = 'none';
}

// Friend search handler
async function handleFriendSearch(event) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    const query = event.target.value.trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/search-users?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');

        const data = await res.json();
        renderSearchResults(searchResults, data.users);
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<p class="error">Error searching for users</p>';
    }
}

function renderSearchResults(container, users) {
    container.innerHTML = '';
    
    if (users && users.length > 0) {
        users.forEach(user => {
            if (user.email === userEmail) return; // Skip current user
            
            const resultDiv = document.createElement('div');
            resultDiv.className = 'user-result';
            resultDiv.innerHTML = `
                <img class="user-avatar" 
                     src="${user.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}`}" 
                     alt="${user.username}">
                <div class="user-info">
                    <h4>${user.username}</h4>
                    <p>${user.email}</p>
                </div>
                <button class="add-friend-btn" data-user-id="${user._id}">Add Friend</button>
            `;

            resultDiv.querySelector('.add-friend-btn').addEventListener('click', () => addFriend(user._id));
            container.appendChild(resultDiv);
        });
    } else {
        container.innerHTML = '<p class="no-results">No users found</p>';
    }
}

// Friend management
async function addFriend(friendId) {
    try {
        const res = await fetch(`${API_BASE}/friends`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                friendId
            })
        });

        if (!res.ok) throw new Error('Failed to add friend');
        
        const result = await res.json();
        alert(result.message);
        closeAddFriendModal();
        fetchFriends();
    } catch (error) {
        alert('Failed to add friend: ' + error.message);
    }
}

// Logout handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadUserProfile();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Failed to initialize dashboard. Please try logging in again.');
    }
});
