// FlowSec Client Configuration
const FlowSecConfig = {
    // API endpoints
    API_BASE: 'https://flowsec-1.onrender.com/',
    AVATAR_API_URL: 'https://ui-avatars.com/api/?name=',
    FILE_API_URL: 'https://flowsec-1.onrender.com/api/files/',
    
    // WebSocket configuration (if needed)
    SOCKET_URL: 'wss://flowsec-1.onrender.com',
    
    // Other configuration parameters
    DEFAULT_TIMEOUT: 30000,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    
    // Helper method to get configuration values
    get: function(key) {
        return this[key];
    }
};

// Prevent modifications to the configuration object
Object.freeze(FlowSecConfig);