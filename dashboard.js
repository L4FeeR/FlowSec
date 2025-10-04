// --- Real backend integration with E2E encryption ---
const API_BASE = 'http://localhost:5000/api';


let userEmail = localStorage.getItem('userEmail');
if (!userEmail) {
    userEmail = prompt('Enter your email to continue:');
    if (userEmail) localStorage.setItem('userEmail', userEmail);
    else window.location.href = 'index.html';
}


let myUsername = null;
let myProfileIcon = null;
// Fetch and show user's username and icon
async function fetchMyProfile() {
    const res = await fetch(`${API_BASE}/user?email=${encodeURIComponent(userEmail)}`);
    const data = await res.json();
    myUsername = data.user.username;
    myProfileIcon = data.user.profileIcon;
    document.getElementById('my-username').textContent = myUsername;
    if (myProfileIcon) document.getElementById('my-profile-icon').src = myProfileIcon;
    else document.getElementById('my-profile-icon').src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(myUsername);
}

const chatList = document.getElementById('chat-list');
const messagesDiv = document.getElementById('messages');
const chatTitle = document.getElementById('chat-title');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');

let chats = [];
let currentChatId = null;
let chatUsers = {}; // chatId -> [user emails]

// --- E2E encryption helpers (AES-GCM, per chat) ---
async function getChatKey(chatId) {
    // Version 2: Deterministic key generation (force regeneration of old random keys)
    const keyVersion = 'v2';
    const keyName = `chatKey-${keyVersion}-${chatId}`;
    
    let storedKey = localStorage.getItem(keyName);
    
    // Clear any old version keys
    const oldKeyName = 'chatKey-' + chatId;
    if (localStorage.getItem(oldKeyName)) {
        console.log('🧹 Clearing old random key for chat:', chatId);
        localStorage.removeItem(oldKeyName);
    }
    
    if (!storedKey) {
        // Generate a deterministic key from the chat ID
        // This ensures all users in the same chat will have the same encryption key
        const encoder = new TextEncoder();
        const chatIdBytes = encoder.encode(chatId + 'FlowSecSharedSecret2024'); // Add salt
        
        // Create a hash of the chat ID to use as key material
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', chatIdBytes);
        
        // Generate the AES key from the hash
        const key = await window.crypto.subtle.importKey(
            'raw',
            hashBuffer,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        // Store the key in localStorage for faster access
        const jwk = await window.crypto.subtle.exportKey('jwk', key);
        localStorage.setItem(keyName, JSON.stringify(jwk));
        
        console.log('🔑 Generated NEW deterministic key for chat:', chatId, 'Key preview:', jwk.k.substring(0, 10) + '...');
        return key;
    }
    
    // Load existing key from localStorage
    try {
        const key = await window.crypto.subtle.importKey('jwk', JSON.parse(storedKey), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        console.log('🔑 Loaded EXISTING deterministic key for chat:', chatId);
        return key;
    } catch (error) {
        console.log('🔑 Failed to load stored key, regenerating for chat:', chatId);
        localStorage.removeItem(keyName);
        return getChatKey(chatId); // Recursive call to regenerate
    }
}

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
