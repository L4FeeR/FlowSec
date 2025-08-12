import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    users: [{ type: String, required: true }], // array of user emails
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', chatSchema);
