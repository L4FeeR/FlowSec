import mongoose from 'mongoose';

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  files: [String], // file paths or URLs
  deadline: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    file: String,
    submittedAt: Date
  }]
});

export default mongoose.model('Assignment', AssignmentSchema);
