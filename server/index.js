import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from './models/User.js';
import Chat from './models/Chat.js';
import Message from './models/Message.js';

// Load env variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
// Configure CORS. Use ALLOWED_ORIGINS env var (comma-separated) or default to '*'.
// Example: ALLOWED_ORIGINS=https://flowsec-2.onrender.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
    origin: function(origin, callback) {
        // allow requests with no origin (e.g., mobile apps, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy: This origin is not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Ensure preflight and error responses include CORS headers (safety net)
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    // Handle preflight
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// OTP Schema
const otpSchema = new mongoose.Schema({
    email: String,
    otp: String,
    createdAt: { type: Date, default: Date.now, expires: 300 } // 5 min expiry
});
const Otp = mongoose.model('Otp', otpSchema);

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP endpoint
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const otp = generateOtp();
    await Otp.deleteMany({ email }); // Remove old OTPs
    await Otp.create({ email, otp });
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Secure Messenger',
            text: `Your OTP is: ${otp}`
        });
        res.json({ message: 'OTP sent' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send OTP', error: err.message });
    }
});

// Verify OTP endpoint
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });
    const record = await Otp.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    await Otp.deleteMany({ email }); // Remove OTP after use
    res.json({ message: 'OTP verified' });
});


// --- Messenger API ---



// Create user (signup)
app.post('/api/user', async (req, res) => {
    const { email, username, profileIcon } = req.body;
    if (!email || !username) return res.status(400).json({ message: 'Email and username required' });
    let user = await User.findOne({ $or: [ { email }, { username } ] });
    if (user) return res.status(400).json({ message: 'Email or username already exists' });
    user = await User.create({ email, username, profileIcon });
    res.json({ user });
});

// Get user by email
app.get('/api/user', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// Search user by username
app.get('/api/user-by-username', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'username required' });
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// Search user by messageId
app.get('/api/user-by-messageid', async (req, res) => {
    const { messageId } = req.query;
    if (!messageId) return res.status(400).json({ message: 'messageId required' });
    const user = await User.findOne({ messageId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// List chats for user
app.get('/api/chats', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const chats = await Chat.find({ users: email });
    res.json({ chats });
});

// Create new chat
app.post('/api/chats', async (req, res) => {
    const { users } = req.body; // array of emails
    if (!users || users.length < 2) return res.status(400).json({ message: 'At least 2 users required' });
    const chat = await Chat.create({ users });
    res.json({ chat });
});

// List messages in chat
app.get('/api/messages', async (req, res) => {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ message: 'chatId required' });
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ messages });
});

// Send message (with optional file)
app.post('/api/messages', upload.single('file'), async (req, res) => {
    const { chatId, sender, encrypted } = req.body;
    if (!chatId || !sender || !encrypted) return res.status(400).json({ message: 'chatId, sender, encrypted required' });
    let file = undefined;
    if (req.file) {
        file = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        };
    }
    const message = await Message.create({ chatId, sender, encrypted, file });
    res.json({ message });
});

// Download file
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
