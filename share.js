document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5001/api';
    const userEmail = localStorage.getItem('userEmail');
    let selectedFriend = null;
    let friends = [];

    const friendsList = document.getElementById('friends-list');
    const currentFriendName = document.getElementById('current-friend-name');
    const currentFriendEmail = document.getElementById('current-friend-email');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const uploadButton = document.querySelector('.upload-button');
    const shareStatus = document.getElementById('upload-status');

    function updateUploadButtonState() {
        uploadButton.disabled = !fileInput.files.length || !selectedFriend;
    }

    async function loadFriends() {
        if (!userEmail) {
            shareStatus.textContent = 'You must be logged in to share files.';
            return;
        }
        try {
            shareStatus.textContent = 'Loading friends...';
            const res = await fetch(`${API_BASE}/friends?email=${encodeURIComponent(userEmail)}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch friends: ${res.statusText}`);
            }
            const data = await res.json();
            if (data.friends && data.friends.length > 0) {
                friends = data.friends;
                renderFriends();
                shareStatus.textContent = 'Select a friend to share files with.';
            } else {
                friendsList.innerHTML = '<div class="no-friends">No friends found.</div>';
                shareStatus.textContent = 'No friends found. Add friends on the dashboard.';
            }
        } catch (err) {
            console.error('Error loading friends:', err);
            shareStatus.textContent = `Error loading friends: ${err.message}`;
        }
    }

    function renderFriends() {
        friendsList.innerHTML = friends.map(friend => `
            <div class="friend-item" data-friend-email="${friend.email}">
                <div class="friend-name">${friend.username}</div>
                <div class="friend-email">${friend.email}</div>
            </div>
        `).join('');

        document.querySelectorAll('.friend-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.friend-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                const friendEmail = item.getAttribute('data-friend-email');
                selectedFriend = friends.find(f => f.email === friendEmail);
                currentFriendName.textContent = selectedFriend.username;
                currentFriendEmail.textContent = selectedFriend.email;
                updateUploadButtonState();
            });
        });
    }

    fileInput.addEventListener('change', () => {
        const fileName = fileInput.files.length > 0 ? fileInput.files[0].name : 'Choose files to upload';
        document.querySelector('.file-input-label span').textContent = fileName;
        updateUploadButtonState();
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file || !selectedFriend) {
            shareStatus.textContent = 'Please select a friend and a file.';
            return;
        }

        try {
            await encryptAndShareFile(file, selectedFriend.email);
        } catch (err) {
            shareStatus.textContent = `Error: ${err.message}`;
            console.error(err);
        }
    });

    async function encryptAndShareFile(file, friendEmail) {
        shareStatus.textContent = 'Encrypting file...';
        const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const fileBuffer = await file.arrayBuffer();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedFile = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, fileBuffer);

        shareStatus.textContent = 'Encrypting key...';
        const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
        const pubRes = await fetch(`${API_BASE}/public-key?email=${encodeURIComponent(friendEmail)}`);
        if (!pubRes.ok) {
            throw new Error('Could not fetch public key for friend.');
        }
        const pubData = await pubRes.json();
        if (!pubData.publicKey) throw new Error('Friend public key not found');

        const friendPublicKey = await window.crypto.subtle.importKey(
            'spki',
            Uint8Array.from(atob(pubData.publicKey), c => c.charCodeAt(0)),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );

        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            friendPublicKey,
            rawAesKey
        );

        const formData = new FormData();
        formData.append('file', new Blob([encryptedFile]), file.name + '.enc');
        formData.append('email', userEmail);
        formData.append('friend', friendEmail);
        formData.append('iv', btoa(String.fromCharCode.apply(null, iv)));
        formData.append('encryptedAesKey', btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))));

        shareStatus.textContent = 'Uploading encrypted file...';
        const res = await fetch(`${API_BASE}/share-file`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'File upload failed.');
        }

        const data = await res.json();
        if (data.success) {
            shareStatus.textContent = 'File shared and encrypted successfully!';
            fileInput.value = ''; // Reset file input
            document.querySelector('.file-input-label span').textContent = 'Choose files to upload';
            updateUploadButtonState();
        } else {
            shareStatus.textContent = data.message || 'Error sharing file.';
        }
    }

    loadFriends();
});