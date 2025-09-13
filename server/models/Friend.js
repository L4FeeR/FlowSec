import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    friendId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'accepted'], 
        default: 'pending' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Create a compound index to ensure unique friendships and prevent duplicates
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

export default mongoose.model('Friend', friendSchema);
