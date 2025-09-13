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
app.use(cors());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
        // Attach user email to filename for filtering
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

// Get user data
app.get('/api/user', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Email required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Get additional user stats
        const [fileCount, friendCount] = await Promise.all([
            FileModel.countDocuments({ userEmail: email }),
            FriendModel.countDocuments({
                $or: [
                    { userId: user._id },
                    { friendId: user._id }
                ],
                status: 'accepted'
            })
        ]);

        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                profileIcon: user.profileIcon
            },
            fileCount,
            friendCount
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user' });
    }
});

// Search users endpoint
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

// Add friend endpoint
app.post('/api/friends', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        
        if (!userId || !friendId) {
            return res.status(400).json({
                success: false,
                message: 'Both userId and friendId are required'
            });
        }

        // Check if friendship already exists
        const existingFriendship = await FriendModel.findOne({
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                // Auto-accept if the other person sent a request
                if (existingFriendship.userId.toString() === friendId) {
                    existingFriendship.status = 'accepted';
                    await existingFriendship.save();
                    return res.json({
                        success: true,
                        message: 'Friend request accepted'
                    });
                }
            }
            return res.json({
                success: false,
                message: 'Friendship already exists'
            });
        }

        // Create new friendship
        const newFriendship = new FriendModel({
            userId,
            friendId,
            status: 'accepted'
        });

        await newFriendship.save();

        res.json({
            success: true,
            message: 'Friend added successfully'
        });
    } catch (error) {
        console.error('Error adding friend:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding friend'
        });
    }
});

// Get friends endpoint
app.get('/api/friends', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'User ID required' });
        }

        // Find all friendships where the user is either userId or friendId
        const friendships = await FriendModel.find({
            $or: [
                { userId: userId },
                { friendId: userId }
            ],
            status: 'accepted'
        });

        // Get all friend IDs
        const friendIds = friendships.map(friendship => 
            friendship.userId.toString() === userId 
                ? friendship.friendId 
                : friendship.userId
        );

        // Get friend details from User model
        const friends = await User.find({
            _id: { $in: friendIds }
        }).select('username email profileIcon _id');

        res.json({ friends });
    } catch (error) {
        console.error('Error fetching friends:', error);
        res.status(500).json({ message: 'Error fetching friends' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
