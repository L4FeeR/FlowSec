import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: String, required: true }, // email
    encrypted: { type: String, required: true }, // encrypted message
    file: {
        filename: String,
        originalname: String,
        mimetype: String,
        size: Number
    },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);
