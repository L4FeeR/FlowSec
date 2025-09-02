import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: String, required: true }, // email or userId
    receiver: { type: String, required: true }, // email or userId
    content: { type: String, required: true },
    file: {
        filename: String,
        originalname: String,
        mimetype: String,
        size: Number
    },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', messageSchema);
