import mongoose from 'mongoose';
import Message from './models/Message.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  const messages = await Message.find().limit(3);
  console.log('Sample messages from database:');
  console.log('Total messages:', messages.length);
  
  messages.forEach((msg, index) => {
    console.log(`\nMessage ${index + 1}:`);
    console.log('  Sender:', msg.sender);
    console.log('  Encrypted content (first 50 chars):', msg.encrypted.substring(0, 50) + '...');
    console.log('  Full encrypted length:', msg.encrypted.length);
    console.log('  Has file:', !!msg.file);
    console.log('  Created:', msg.createdAt);
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Connection error:', err);
  process.exit(1);
});