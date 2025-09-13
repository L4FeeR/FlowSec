import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, unique: true },
    size: { type: Number, required: true },
    mimetype: { type: String, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model('File', fileSchema);
