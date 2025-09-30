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
const API_BASE = 'http://localhost:5000/api';

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
    try {
        console.log('Verifying OTP for:', email);
        const res = await postData(`${API_BASE}/verify-otp`, { email, otp });
        console.log('OTP verification response:', res);
        
        if (res.message === 'OTP verified' && res.user) {
            // Store user data directly from the OTP verification response
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userId', res.user._id);
            localStorage.setItem('username', res.user.username || email.split('@')[0]);
            
            // Navigate to dashboard
            window.location.href = 'dashboard.html';
        } else {
            alert(res.message || 'OTP verification failed.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login. Please try again.');
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
        // Generate RSA key pair
        const keyPair = await window.crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
            true,
            ['encrypt', 'decrypt']
        );
        // Export public key (spki)
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
        // Export private key (pkcs8)
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
        // Store private key in localStorage
        localStorage.setItem('privateKey', privateKeyBase64);
        // Now create user with username, icon, and public key
        const userRes = await postData(`${API_BASE}/user`, { email, username, profileIcon, publicKey: publicKeyBase64 });
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
