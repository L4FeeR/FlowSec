const API_BASE = 'http://localhost:5000/api';

// Global state
let userEmail = localStorage.getItem('userEmail');
let userId = localStorage.getItem('userId');
let username = localStorage.getItem('username');

// Check if user is logged in
if (!userEmail) {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    await fetchFriends();
    await fetchUserFiles();
});

async function loadUserProfile() {
    try {
        const res = await fetch(`${API_BASE}/user?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch user data');
        
        const data = await res.json();
        const user = data.user;

        username = user.username;
        userId = user._id;

        localStorage.setItem('username', username);
        localStorage.setItem('userId', userId);

        document.getElementById('dashboard-username').textContent = username;
        document.getElementById('user-id').textContent = `ID: ${userId}`;
        document.getElementById('user-email').textContent = userEmail;
        document.getElementById('profile-picture').src = user.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
        document.getElementById('files-count').textContent = user.stats?.files || 0;
        document.getElementById('friends-count').textContent = user.stats?.friends || 0;
        
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('dashboard-username').textContent = 'Error loading profile';
    }
}

async function fetchFriends() {
    try {
        const res = await fetch(`${API_BASE}/friends?email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        
        const data = await res.json();
        const friendsList = document.getElementById('friends-list');
        
        if (!friendsList) return;
        
        friendsList.innerHTML = ''; 
        
        if (!data.friends || data.friends.length === 0) {
            friendsList.innerHTML = `
                <div class="no-friends-message">
                    <p>You haven't added any friends yet</p>
                </div>
            `;
            return;
        }

        data.friends.forEach(friend => {
            const friendCard = document.createElement('div');
            friendCard.className = 'friend-card';
            
            const avatarUrl = friend.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}`;
            
            friendCard.innerHTML = `
                <img src="${avatarUrl}" alt="${friend.username}" class="friend-avatar">
                <h3 class="friend-name">${friend.username}</h3>
                <p class="friend-email">${friend.email}</p>
                <div class="friend-actions">
                    <button class="friend-action-btn chat-btn" onclick="startChat('${friend._id}')">
                        💬 Chat
                    </button>
                    <button class="friend-action-btn share-btn" onclick="shareWithFriend('${friend._id}')">
                        📤 Share
                    </button>
                </div>
            `;
            
            friendsList.appendChild(friendCard);
        });
        
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

async function fetchUserFiles() {
    const filesList = document.getElementById('activity-list');
    if (!filesList) return;

    try {
        const res = await fetch(`${API_BASE}/list-files?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        
        if (data.files && data.files.length) {
            filesList.innerHTML = data.files.map(file => `
                <div class="file-item">
                    <span class="file-name">${file.originalName}</span>
                </div>
            `).join('');
        } else {
            filesList.innerHTML = '<p class="no-files">No files uploaded yet</p>';
        }
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = '<p class="error">Error loading files</p>';
    }
}

function openAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('friend-search').focus();
}

function closeAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.getElementById('friend-search').value = '';
    document.getElementById('search-results').innerHTML = '';
}

let searchTimeout = null;
function searchUsers(query) {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    if (!query.trim()) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_BASE}/search-users?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Failed to search users');
            }
            const data = await response.json();
            displaySearchResults(data.users);
        } catch (error) {
            console.error('Error searching users:', error);
            document.getElementById('search-results').innerHTML = `
                <div class="error-message">
                    <p>Error searching users. Please try again.</p>
                </div>
            `;
        }
    }, 300);
}

function displaySearchResults(users) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    searchResults.innerHTML = '';

    if (!users || users.length === 0) {
        searchResults.innerHTML = `
            <div class="no-results">
                <p>No users found</p>
            </div>
        `;
        return;
    }

    users.forEach(user => {
        if (user._id === userId) return;

        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        
        const avatarUrl = user.profileIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}`;
        
        userCard.innerHTML = `
            <img src="${avatarUrl}" alt="${user.username}" class="user-card-avatar">
            <div class="user-card-info">
                <h4 class="user-card-name">${user.username}</h4>
                <p class="user-card-email">${user.email}</p>
            </div>
            <button 
                onclick="addFriend('${user._id}')" 
                class="add-friend-action"
                id="add-friend-${user._id}">
                Add Friend
            </button>
        `;
        
        searchResults.appendChild(userCard);
    });
}

async function addFriend(friendId) {
    const button = document.getElementById(`add-friend-${friendId}`);
    if (!button || button.classList.contains('added')) return;

    try {
        button.textContent = 'Adding...';
        button.disabled = true;

        const response = await fetch(`${API_BASE}/friends`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                friendId: friendId
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            button.textContent = 'Added ✓';
            button.classList.add('added');
            await fetchFriends();
        } else {
            button.textContent = data.message || 'Failed';
            button.disabled = false;
        }
    } catch (error) {
        console.error('Error adding friend:', error);
        button.textContent = 'Failed';
        button.disabled = false;
    }
}

function startChat(friendId) {
    window.location.href = `chat.html?friend=${friendId}`;
}

function shareWithFriend(friendId) {
    window.location.href = `share.html?friend=${friendId}`;
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}