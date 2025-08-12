
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    profileIcon: { type: String, default: '' }, // URL or base64
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
