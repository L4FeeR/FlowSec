
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    profileIcon: { type: String, default: '' }, // URL or base64
    publicKey: { type: String, default: '' }, // base64 encoded public key
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
