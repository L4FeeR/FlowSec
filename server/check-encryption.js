import mongoose from 'mongoose';
import Message from './models/Message.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  // Get the most recent messages to see if they are encrypted
  const recentMessages = await Message.find().sort({ createdAt: -1 }).limit(5);
  
  console.log('\n=== Recent Messages Analysis ===');
  console.log(`Total recent messages: ${recentMessages.length}\n`);
  
  recentMessages.forEach((msg, index) => {
    console.log(`Message ${index + 1}:`);
    console.log('  ID:', msg._id);
    console.log('  Sender:', msg.sender);
    console.log('  Encrypted content:', msg.encrypted);
    console.log('  Content length:', msg.encrypted.length);
    console.log('  Looks encrypted:', isEncrypted(msg.encrypted));
    console.log('  Has file:', !!msg.file);
    console.log('  Created:', msg.createdAt);
    console.log('  ---');
  });
  
  // Check total message count
  const totalCount = await Message.countDocuments();
  console.log(`\nTotal messages in database: ${totalCount}`);
  
  process.exit(0);
}).catch(err => {
  console.error('Connection error:', err);
  process.exit(1);
});

function isEncrypted(text) {
  // Basic check for encrypted content
  // AES-GCM encrypted content should be base64 and longer than plain text
  return text.length > 50 && /^[A-Za-z0-9+/]*={0,2}$/.test(text);
}