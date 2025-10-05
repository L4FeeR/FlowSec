// UI switching logic
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');

showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'flex';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'flex';
});

// Helper to call backend
async function postData(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// OTP logic
//const API_BASE = 'http://localhost:5000/api';
const API_BASE=https://flowsec-1.onrender.com/api;

document.getElementById('send-otp').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    if (!email) {
        alert('Please enter your email.');
        return;
    }
    const res = await postData(`${API_BASE}/send-otp`, { email });
    if (res.message === 'OTP sent') {
        document.getElementById('otp-group').style.display = 'flex';
        document.getElementById('login-btn').style.display = 'block';
        alert('OTP sent to your email.');
    } else {
        alert(res.message || 'Failed to send OTP.');
    }
});

document.getElementById('signup-send-otp').addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    if (!email) {
        alert('Please enter your email.');
        return;
    }
    const res = await postData(`${API_BASE}/send-otp`, { email });
    if (res.message === 'OTP sent') {
        document.getElementById('signup-otp-group').style.display = 'flex';
        document.getElementById('signup-btn').style.display = 'block';
        alert('OTP sent to your email.');
    } else {
        alert(res.message || 'Failed to send OTP.');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const otp = document.getElementById('otp').value;
    if (otp.length !== 6) {
        alert('Please enter a valid 6-digit OTP.');
        return;
    }
    const res = await postData(`${API_BASE}/verify-otp`, { email, otp });
    if (res.message === 'OTP verified') {
        localStorage.setItem('userEmail', email);
        window.location.href = 'dashboard.html';
    } else {
        alert(res.message || 'OTP verification failed.');
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const username = document.getElementById('signup-username').value;
    const otp = document.getElementById('signup-otp').value;
    let profileIcon = '';
    const iconInput = document.getElementById('signup-icon');
    if (iconInput.files && iconInput.files[0]) {
        const file = iconInput.files[0];
        const reader = new FileReader();
        profileIcon = await new Promise(resolve => {
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }
    if (otp.length !== 6) {
        alert('Please enter a valid 6-digit OTP.');
        return;
    }
    const res = await postData(`${API_BASE}/verify-otp`, { email, otp });
    if (res.message === 'OTP verified') {
        // Now create user with username and icon
        const userRes = await postData(`${API_BASE}/user`, { email, username, profileIcon });
        if (userRes.user) {
            localStorage.setItem('userEmail', email);
            window.location.href = 'dashboard.html';
        } else {
            alert(userRes.message || 'Signup failed.');
        }
    } else {
        alert(res.message || 'OTP verification failed.');
    }
});
