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
import VaultFile from './models/VaultFile.js';
import VaultLink from './models/VaultLink.js';
import SecurityScanner from './SecurityScanner.js';

// Load env variables
dotenv.config();

// Initialize Security Scanner
const securityScanner = new SecurityScanner(process.env.VIRUSTOTAL_API_KEY);

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
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


// --- Vault Security API ---

// Get all vault files for user
app.get('/api/vault/files', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const files = await VaultFile.findByUser(userId);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault files', error: error.message });
    }
});

// Get all vault links for user
app.get('/api/vault/links', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const links = await VaultLink.findByUser(userId);
        res.json({ links });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault links', error: error.message });
    }
});

// Get vault statistics
app.get('/api/vault/stats', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: 'User ID required' });
        
        const [fileStats, linkStats] = await Promise.all([
            VaultFile.getStats(userId),
            VaultLink.getStats(userId)
        ]);
        
        res.json({ 
            files: fileStats,
            links: linkStats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vault stats', error: error.message });
    }
});

// Scan file endpoint
app.post('/api/vault/scan-file', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ message: 'File ID required' });
        
        const vaultFile = await VaultFile.findById(fileId);
        if (!vaultFile) return res.status(404).json({ message: 'File not found' });
        
        // Update status to scanning
        vaultFile.scanStatus = 'scanning';
        await vaultFile.save();
        
        // Perform scan
        const filePath = path.join(process.cwd(), 'uploads', vaultFile.filename);
        const scanResult = await securityScanner.scanFile(filePath);
        
        // Update with results
        await vaultFile.updateScanResults(scanResult);
        
        res.json({ message: 'File scanned successfully', result: scanResult });
    } catch (error) {
        res.status(500).json({ message: 'Error scanning file', error: error.message });
    }
});

// Scan URL endpoint
app.post('/api/vault/scan-url', async (req, res) => {
    try {
        const { url, userId, recipient, chatId } = req.body;
        if (!url || !userId) return res.status(400).json({ message: 'URL and user ID required' });
        
        // Create vault link entry
        const urlHash = await securityScanner.calculateHash(url);
        const domain = new URL(url).hostname;
        
        const vaultLink = await VaultLink.create({
            userId,
            url,
            urlHash,
            domain,
            recipient: recipient || 'unknown',
            chatId: chatId || 'unknown',
            scanStatus: 'scanning'
        });
        
        // Perform scan
        const scanResult = await securityScanner.scanURL(url);
        
        // Update with results
        await vaultLink.updateScanResults(scanResult);
        
        res.json({ message: 'URL scanned successfully', result: scanResult });
    } catch (error) {
        res.status(500).json({ message: 'Error scanning URL', error: error.message });
    }
});

// Quarantine file
app.post('/api/vault/quarantine', async (req, res) => {
    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ message: 'File ID required' });
        
        const vaultFile = await VaultFile.findById(fileId);
        if (!vaultFile) return res.status(404).json({ message: 'File not found' });
        
        await vaultFile.quarantine();
        
        res.json({ message: 'File quarantined successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error quarantining file', error: error.message });
    }
});

// Block domain
app.post('/api/vault/block-domain', async (req, res) => {
    try {
        const { linkId } = req.body;
        if (!linkId) return res.status(400).json({ message: 'Link ID required' });
        
        const vaultLink = await VaultLink.findById(linkId);
        if (!vaultLink) return res.status(404).json({ message: 'Link not found' });
        
        await vaultLink.blockDomain();
        
        res.json({ message: 'Domain blocked successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error blocking domain', error: error.message });
    }
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
    let vaultFileId = null;
    
    if (req.file) {
        file = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        };
        
        // Create vault file entry for security scanning
        try {
            const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
            const fileHash = await securityScanner.calculateFileHash(filePath);
            
            const vaultFile = await VaultFile.create({
                userId: sender,
                filename: req.file.filename,
                originalName: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                fileHash,
                recipient: 'chat-recipient', // You can extract this from chat participants
                chatId,
                scanStatus: 'pending'
            });
            
            vaultFileId = vaultFile._id;
            
            // Start background scan (don't wait for completion)
            securityScanner.scanFile(filePath)
                .then(scanResult => vaultFile.updateScanResults(scanResult))
                .catch(error => {
                    console.error('Background file scan failed:', error);
                    vaultFile.scanStatus = 'error';
                    vaultFile.save();
                });
                
        } catch (error) {
            console.error('Error creating vault file entry:', error);
        }
    }
    
    // Check for URLs in the encrypted message and scan them
    try {
        // Note: This is a basic URL detection - in real implementation,
        // you might want to decrypt the message first or scan after decryption
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = encrypted.match(urlRegex);
        
        if (urls && urls.length > 0) {
            // Scan URLs in background
            urls.forEach(async (url) => {
                try {
                    const urlHash = await securityScanner.calculateHash(url);
                    const domain = new URL(url).hostname;
                    
                    const vaultLink = await VaultLink.create({
                        userId: sender,
                        url,
                        urlHash,
                        domain,
                        recipient: 'chat-recipient',
                        chatId,
                        scanStatus: 'scanning'
                    });
                    
                    const scanResult = await securityScanner.scanURL(url);
                    await vaultLink.updateScanResults(scanResult);
                } catch (error) {
                    console.error('Background URL scan failed:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error scanning URLs in message:', error);
    }
    
    const message = await Message.create({ chatId, sender, encrypted, file, vaultFileId });
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
