import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    users: [{ type: String, required: true }], // array of user emails or userIds
    chatType: { type: String, enum: ['private', 'group'], default: 'private' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', chatSchema);
