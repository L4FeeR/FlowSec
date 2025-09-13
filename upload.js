// Handles file upload via AJAX
const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const API_BASE = 'http://localhost:5000/api';

// Get user email from localStorage
const userEmail = localStorage.getItem('userEmail');
let userInfo = null;

// Fetch user info
async function fetchUserInfo() {
    if (!userEmail) {
        uploadStatus.textContent = 'User not signed in.';
        document.getElementById('user-id-display').textContent = 'User not signed in.';
        return;
    }
    const res = await fetch(`${API_BASE}/user?email=${encodeURIComponent(userEmail)}`);
    const data = await res.json();
    if (data.user) {
        userInfo = data.user;
        document.getElementById('user-id-display').textContent = `User: ${userInfo.username} (${userInfo.email})`;
    } else {
        uploadStatus.textContent = 'User info not found.';
        document.getElementById('user-id-display').textContent = 'User info not found.';
    }
}

// List all files for the user (from uploads folder)
async function listUserFiles() {
    // Only list files belonging to the user
    const res = await fetch(`${API_BASE}/list-files?email=${encodeURIComponent(userEmail)}`);
    const data = await res.json();
    if (data.files && data.files.length) {
        // Filter files by user email in filename (e.g., email in filename)
        const filtered = data.files.filter(f => f.includes(userEmail));
        if (filtered.length) {
            const list = filtered.map(f => `<li><a href="/uploads/${f}" download>${f}</a></li>`).join('');
            document.getElementById('user-files').innerHTML = `<h3>Your Files:</h3><ul>${list}</ul>`;
        } else {
            document.getElementById('user-files').innerHTML = '<h3>Your Files:</h3><p>No files found.</p>';
        }
    } else {
        document.getElementById('user-files').innerHTML = '<h3>Your Files:</h3><p>No files found.</p>';
    }
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file');
    if (!fileInput.files.length) {
        uploadStatus.textContent = 'Please select a file.';
        return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('email', userEmail);
    uploadStatus.textContent = 'Uploading...';
    try {
        const res = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            uploadStatus.textContent = 'File uploaded successfully!';
            listUserFiles();
        } else {
            uploadStatus.textContent = data.message || 'Upload failed.';
        }
    } catch (err) {
        uploadStatus.textContent = 'Error uploading file.';
    }
});

window.onload = async () => {
    await fetchUserInfo();
    await listUserFiles();
}
