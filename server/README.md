# Secure Messenger Backend

## Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB URI and Gmail credentials.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the server:
   ```sh
   npm start
   ```

## API Endpoints

- `POST /api/send-otp` — `{ email }` in JSON body. Sends OTP to email.
- `POST /api/verify-otp` — `{ email, otp }` in JSON body. Verifies OTP.

## Notes
- Uses MongoDB for OTP storage (expires in 5 minutes).
- Uses Gmail SMTP (enable "App Passwords" for Gmail accounts with 2FA).
