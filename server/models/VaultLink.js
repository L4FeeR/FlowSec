import mongoose from 'mongoose';

const vaultLinkSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    url: {
        type: String,
        required: true
    },
    urlHash: {
        type: String,
        required: true,
        index: true
    },
    domain: {
        type: String,
        required: true,
        index: true
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
    isBlocked: {
        type: Boolean,
        default: false
    },
    blockedDate: {
        type: Date,
        sparse: true
    },
    metadata: {
        sentDate: {
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
        },
        clicks: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for better performance
vaultLinkSchema.index({ userId: 1, scanDate: -1 });
vaultLinkSchema.index({ urlHash: 1 });
vaultLinkSchema.index({ domain: 1 });
vaultLinkSchema.index({ scanStatus: 1 });
vaultLinkSchema.index({ 'scanResults.engines.positives': 1 });

// Virtual for determining if link is safe
vaultLinkSchema.virtual('isSafe').get(function() {
    return this.scanStatus === 'safe' && this.scanResults.engines.positives === 0;
});

// Virtual for threat level
vaultLinkSchema.virtual('threatLevel').get(function() {
    if (this.scanStatus !== 'malicious' || this.scanResults.engines.positives === 0) {
        return 'none';
    }
    
    const highThreatCount = this.scanResults.threats.filter(t => t.level === 'high').length;
    const mediumThreatCount = this.scanResults.threats.filter(t => t.level === 'medium').length;
    
    if (highThreatCount > 0) return 'high';
    if (mediumThreatCount > 0) return 'medium';
    return 'low';
});

// Static method to find links by user
vaultLinkSchema.statics.findByUser = function(userId) {
    return this.find({ userId }).sort({ scanDate: -1 });
};

// Static method to find malicious links
vaultLinkSchema.statics.findMaliciousLinks = function(userId) {
    return this.find({ 
        userId, 
        scanStatus: 'malicious',
        'scanResults.engines.positives': { $gt: 0 }
    }).sort({ scanDate: -1 });
};

// Static method to find links by domain
vaultLinkSchema.statics.findByDomain = function(domain) {
    return this.find({ domain }).sort({ scanDate: -1 });
};

// Static method to get scan statistics
vaultLinkSchema.statics.getStats = function(userId) {
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
vaultLinkSchema.methods.updateScanResults = function(scanData) {
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

// Instance method to block domain
vaultLinkSchema.methods.blockDomain = function() {
    this.isBlocked = true;
    this.blockedDate = new Date();
    return this.save();
};

// Instance method to increment click count
vaultLinkSchema.methods.incrementClicks = function() {
    this.metadata.clicks += 1;
    return this.save();
};

const VaultLink = mongoose.model('VaultLink', vaultLinkSchema);

export default VaultLink;
