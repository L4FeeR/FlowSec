import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
  type: String, // 'assignment', 'material', 'message', etc.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: String,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Activity', ActivitySchema);
