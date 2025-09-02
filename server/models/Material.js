import mongoose from 'mongoose';

const MaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  file: String, // file path or URL
  type: String, // e.g., 'video', 'pdf', 'doc'
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Material', MaterialSchema);
