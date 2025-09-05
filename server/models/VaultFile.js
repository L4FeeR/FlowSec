import mongoose from 'mongoose';

const vaultFileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    fileName: {
        type: String,
        required: true
    },
    originalPath: {
        type: String,
        required: true
    },
    fileHash: {
        type: String,
        required: true,
        index: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    recipient: {
        type: String,
        required: true
    },
    chatId: {
        type: String,
        required: true
    },
    scanStatus: {
        type: String,
        enum: ['pending', 'scanning', 'safe', 'malicious', 'error'],
        default: 'pending'
    },
    scanDate: {
        type: Date,
        default: Date.now
    },
    virusTotalId: {
        type: String,
        sparse: true
    },
    scanResults: {
        engines: {
            total: { type: Number, default: 0 },
            positives: { type: Number, default: 0 }
        },
        threats: [{
            engine: String,
            name: String,
            level: {
                type: String,
                enum: ['low', 'medium', 'high']
            },
            description: String
        }],
        permalink: String
    },
    isQuarantined: {
        type: Boolean,
        default: false
    },
    quarantineDate: {
        type: Date,
        sparse: true
    },
    metadata: {
        uploadDate: {
            type: Date,
            default: Date.now
        },
        lastScanned: {
            type: Date,
            default: Date.now
        },
        scanCount: {
            type: Number,
            default: 1
        }
    }
}, {
    timestamps: true
});

// Indexes for better performance
vaultFileSchema.index({ userId: 1, scanDate: -1 });
vaultFileSchema.index({ fileHash: 1 });
vaultFileSchema.index({ scanStatus: 1 });
vaultFileSchema.index({ 'scanResults.engines.positives': 1 });

// Virtual for determining if file is safe
vaultFileSchema.virtual('isSafe').get(function() {
    return this.scanStatus === 'safe' && this.scanResults.engines.positives === 0;
});

// Virtual for threat level
vaultFileSchema.virtual('threatLevel').get(function() {
    if (this.scanStatus !== 'malicious' || this.scanResults.engines.positives === 0) {
        return 'none';
    }
    
    const highThreatCount = this.scanResults.threats.filter(t => t.level === 'high').length;
    const mediumThreatCount = this.scanResults.threats.filter(t => t.level === 'medium').length;
    
    if (highThreatCount > 0) return 'high';
    if (mediumThreatCount > 0) return 'medium';
    return 'low';
});

// Static method to find files by user
vaultFileSchema.statics.findByUser = function(userId) {
    return this.find({ userId }).sort({ scanDate: -1 });
};

// Static method to find malicious files
vaultFileSchema.statics.findMaliciousFiles = function(userId) {
    return this.find({ 
        userId, 
        scanStatus: 'malicious',
        'scanResults.engines.positives': { $gt: 0 }
    }).sort({ scanDate: -1 });
};

// Static method to get scan statistics
vaultFileSchema.statics.getStats = function(userId) {
    return this.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: '$scanStatus',
                count: { $sum: 1 }
            }
        }
    ]);
};

// Instance method to update scan results
vaultFileSchema.methods.updateScanResults = function(scanData) {
    this.scanStatus = scanData.status;
    this.virusTotalId = scanData.virusTotalId;
    this.scanResults = {
        engines: scanData.engines,
        threats: scanData.threats || [],
        permalink: scanData.permalink
    };
    this.metadata.lastScanned = new Date();
    this.metadata.scanCount += 1;
    
    return this.save();
};

// Instance method to quarantine file
vaultFileSchema.methods.quarantine = function() {
    this.isQuarantined = true;
    this.quarantineDate = new Date();
    return this.save();
};

const VaultFile = mongoose.model('VaultFile', vaultFileSchema);

export default VaultFile;
