// Test script to send an encrypted message via API
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function testEncryption() {
    console.log('Testing message encryption...');
    
    // First, let's get or create a chat
    const chatData = {
        users: ['akashkalimuthu4@gmail.com', 'akashkalimuthu4_bcs27@mepcoeng.ac.in']
    };
    
    const chatResponse = await fetch(`${API_BASE}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData)
    });
    
    const chat = await chatResponse.json();
    console.log('Chat created/found:', chat.chat?._id);
    
    // Now send an encrypted message
    const testMessage = `ENCRYPTION_TEST_${Date.now()}`;
    console.log('Original message:', testMessage);
    
    // Simulate the encryption that should happen in the frontend
    // For now, let's send a clearly identifiable encrypted string
    const mockEncrypted = `ENCRYPTED_${testMessage}_${Date.now()}`;
    
    const messageData = {
        chatId: chat.chat?._id,
        sender: 'akashkalimuthu4@gmail.com',
        encrypted: mockEncrypted
    };
    
    const messageResponse = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
    });
    
    const result = await messageResponse.json();
    console.log('Message sent:', result);
    
    return { chatId: chat.chat?._id, originalMessage: testMessage, encrypted: mockEncrypted };
}

testEncryption().then(result => {
    console.log('Test completed:', result);
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});