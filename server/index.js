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
import FileModel from './models/File.js';
import FriendRequest from './models/FriendRequest.js';
import FriendModel from './models/Friend.js';
import KeyModel from './models/Key.js';

// Load env variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
        let email = req.body.email || 'unknown';
        email = email.replace(/[^a-zA-Z0-9@.]/g, '_');
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${email}--${unique}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// MongoDB connection
if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Please check your .env file and environment variables.');
    process.exit(1);
}
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

// API Endpoints

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const otp = generateOtp();
    await Otp.deleteMany({ email });
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

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });
    const record = await Otp.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    await Otp.deleteMany({ email });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'OTP verified', user });
});

app.post('/api/user', async (req, res) => {
    const { email, username, profileIcon, publicKey } = req.body;
    if (!email || !username || !publicKey) return res.status(400).json({ message: 'Email, username, and publicKey required' });
    let user = await User.findOne({ $or: [ { email }, { username } ] });
    if (user) return res.status(400).json({ message: 'Email or username already exists' });
    user = await User.create({ email, username, profileIcon, publicKey });
    res.json({ user });
});

app.get('/api/user', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const [fileCount, friendCount] = await Promise.all([
            FileModel.countDocuments({ userEmail: email }),
            FriendModel.countDocuments({
                $or: [
                    { userId: user._id, status: 'accepted' },
                    { friendId: user._id, status: 'accepted' }
                ]
            })
        ]);

        res.json({
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                profileIcon: user.profileIcon,
                stats: {
                    files: fileCount,
                    friends: friendCount
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/search-users', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ users: [] });

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).select('username email profileIcon _id');

        res.json({ users });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Error searching users' });
    }
});

app.post('/api/friends', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) {
            return res.status(400).json({ message: 'Both userId and friendId are required' });
        }

        const [user, friend] = await Promise.all([
            User.findById(userId),
            User.findById(friendId)
        ]);

        if (!user || !friend) {
            return res.status(404).json({ message: 'User or friend not found' });
        }

        const existingFriendship = await FriendModel.findOne({
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                existingFriendship.status = 'accepted';
                await existingFriendship.save();
                return res.json({ success: true, message: 'Friend request accepted.' });
            }
            return res.status(400).json({ message: 'Friendship already exists' });
        }

        await FriendModel.create({ userId, friendId, status: 'accepted' });

        res.json({ success: true, message: 'Friend added successfully' });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ success: false, message: 'Failed to add friend' });
    }
});

app.get('/api/friends', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required.' });
        
        const user = await User.findOne({email});
        if (!user) return res.status(404).json({message: "User not found"});

        const friendships = await FriendModel.find({
            $or: [{ userId: user._id }, { friendId: user._id }]
        }).populate('userId').populate('friendId');

        const friends = friendships.map(friendship => {
            if (friendship.userId._id.toString() === user._id.toString()) {
                return friendship.friendId;
            } else {
                return friendship.userId;
            }
        });

        res.json({ friends });
    } catch (error) {
        console.error('Error fetching friends:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/public-key', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required.' });
    const user = await User.findOne({ email });
    if (!user || !user.publicKey) return res.status(404).json({ message: 'Public key not found.' });
    res.json({ publicKey: user.publicKey });
});

app.post('/api/share-file', upload.single('file'), async (req, res) => {
    const { email, friend, iv, encryptedAesKey } = req.body;
    console.log('Received share-file request:');
    console.log('  req.file:', req.file ? 'Received' : 'Missing');
    console.log('  email:', email);
    console.log('  friend:', friend);
    console.log('  iv:', iv ? 'Received' : 'Missing');
    console.log('  encryptedAesKey:', encryptedAesKey ? 'Received' : 'Missing');

    if (!req.file || !email || !friend || !iv || !encryptedAesKey) {
        console.error('Missing data in share-file request. Sending 400.');
        return res.status(400).json({ success: false, message: 'Missing data.' });
    }
    try {
        const fileDoc = await FileModel.create({
            userEmail: email,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path,
        });
        await KeyModel.create({
            fileId: fileDoc._id,
            ownerEmail: friend,
            encryptedAESKey: encryptedAesKey,
            iv: iv,
            encryptedFor: friend
        });
        res.json({ success: true, file: fileDoc });
    } catch (err) {
        console.error('Error in /api/share-file:', err);
        res.status(500).json({ success: false, message: 'Error sharing file.' });
    }
});

app.get('/api/shared-files', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ files: [], message: 'Email required.' });
    const keys = await KeyModel.find({ ownerEmail: email }).populate('fileId');
    const files = keys.map(k => ({
        storedName: k.fileId.storedName,
        originalName: k.fileId.originalName,
        sharedWith: k.encryptedFor
    }));
    res.json({ files });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    try {
        const fileDoc = await FileModel.create({
            userEmail: req.body.email,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path,
        });
        res.json({ success: true, filename: req.file.filename, message: 'File uploaded.', file: fileDoc });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error saving file metadata.' });
    }
});

app.get('/api/list-files', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ files: [], message: 'Email required.' });
    try {
        const files = await FileModel.find({ userEmail: email }).sort({ uploadedAt: -1 });
        res.json({ files });
    } catch (err) {
        res.status(500).json({ files: [], message: 'Error reading files.' });
    }
});

app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
