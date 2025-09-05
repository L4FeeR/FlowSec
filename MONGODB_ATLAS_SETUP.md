# MongoDB Atlas Setup Guide for FlowSec

## Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/atlas
2. Sign up for a free account
3. Create a new project (e.g., "FlowSec")

## Step 2: Create a Cluster
1. Click "Build a Database"
2. Choose "FREE" shared cluster
3. Select your preferred cloud provider and region
4. Name your cluster (e.g., "flowsec-cluster")
5. Click "Create Cluster"

## Step 3: Create Database User
1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `flowsec_user` (or your choice)
5. Password: Generate a secure password
6. Database User Privileges: "Read and write to any database"
7. Click "Add User"

## Step 4: Configure Network Access
1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0) for development
   - For production, add only your server's IP
4. Click "Confirm"

## Step 5: Get Connection String
1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string

## Step 6: Update Your .env File
Replace the MongoDB URI in your `.env` file with your Atlas connection string:

```env
# Replace these placeholders with your actual values:
MONGODB_URI=mongodb+srv://flowsec_user:YOUR_PASSWORD@flowsec-cluster.xxxxx.mongodb.net/flowsec?retryWrites=true&w=majority
```

### Important Replacements:
- `flowsec_user` → Your database username
- `YOUR_PASSWORD` → Your database user password
- `flowsec-cluster.xxxxx` → Your actual cluster name
- `flowsec` → Your database name (can be any name you want)

## Step 7: Test Connection
1. Start your server: `npm start`
2. Check the console for "MongoDB connected" message
3. If you see connection errors, double-check:
   - Username and password are correct
   - IP address is whitelisted
   - Connection string format is correct

## Example Complete Connection String:
```
mongodb+srv://flowsec_user:MySecurePass123@flowsec-cluster.abc123.mongodb.net/flowsec?retryWrites=true&w=majority
```

## Security Notes:
- Never commit your `.env` file to version control
- Use strong passwords for database users
- In production, restrict IP access to your server only
- Consider using MongoDB Atlas environment variables for extra security

## Database Collections Created Automatically:
- `users` - User accounts and profiles
- `chats` - Chat conversations
- `messages` - Individual messages
- `vaultfiles` - Scanned file records
- `vaultlinks` - Scanned URL records
- `otps` - Temporary OTP codes

Your FlowSec application will automatically create these collections when data is first inserted.
