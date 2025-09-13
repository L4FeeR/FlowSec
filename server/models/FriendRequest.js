import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
    from: { type: String, required: true }, // email
    to: { type: String, required: true },   // email
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('FriendRequest', friendRequestSchema);
