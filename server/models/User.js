
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    profileIcon: { type: String, default: '' }, // URL or base64
    role: { type: String, enum: ['student', 'teacher'], required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
