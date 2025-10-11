import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import net from 'net';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from './models/User.js';
import Chat from './models/Chat.js';
import Message from './models/Message.js';

// Load env variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
// Configure CORS. Use ALLOWED_ORIGINS env var (comma-separated) or default to '*'.
// Example: ALLOWED_ORIGINS=https://flowsec-2.onrender.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
    origin: function(origin, callback) {
        // allow requests with no origin (e.g., mobile apps, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy: This origin is not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Ensure preflight and error responses include CORS headers (safety net)
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    // Handle preflight
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(process.cwd(), 'uploads'));
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// OTP Schema
const otpSchema = new mongoose.Schema({
    email: String,
    otp: String,
    createdAt: { type: Date, default: Date.now, expires: 300 } // 5 min expiry
});
const Otp = mongoose.model('Otp', otpSchema);

// Nodemailer setup
let transporter;
let transporterType = 'none';
let sendgridEnabled = false;
const MAIL_CONN_TIMEOUT = parseInt(process.env.MAIL_CONN_TIMEOUT || '30000', 10);
const MAIL_GREETING_TIMEOUT = parseInt(process.env.MAIL_GREETING_TIMEOUT || '30000', 10);
const MAIL_SOCKET_TIMEOUT = parseInt(process.env.MAIL_SOCKET_TIMEOUT || '30000', 10);
const MAIL_DEBUG = (process.env.DEBUG_MAIL === 'true');
const MAIL_DEBUG_NET = (process.env.MAIL_DEBUG_NET === 'true');

// Helper options applied to transports for better timeouts and optional debug
const transportBaseOptions = {
    logger: MAIL_DEBUG,
    debug: MAIL_DEBUG,
    connectionTimeout: MAIL_CONN_TIMEOUT,
    greetingTimeout: MAIL_GREETING_TIMEOUT,
    socketTimeout: MAIL_SOCKET_TIMEOUT,
    tls: { rejectUnauthorized: false }
};

if (process.env.SENDGRID_API_KEY) {
    // Prefer SendGrid HTTP API when API key provided — avoids SMTP egress issues on some hosts
    sendgridEnabled = true;
    transporterType = 'sendgrid-api';
    console.log('Mailer: configured to use SendGrid HTTP API (SENDGRID_API_KEY detected)');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Fallback to Gmail SMTP (requires app password / proper credentials)
    // Try port 587 with STARTTLS (more likely to work than 465 on restricted hosts)
    transporter = nodemailer.createTransport(Object.assign({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    }, transportBaseOptions));
    transporterType = 'gmail-587';
    console.log('Mailer: configured to use Gmail SMTP port 587 (EMAIL_USER set)');
} else {
    // No external SMTP configured — use a JSON transport that writes emails to logs (development fallback).
    console.warn('Mailer: no mail credentials found (set SENDGRID_API_KEY or EMAIL_USER/EMAIL_PASS). Using jsonTransport fallback for development.');
    transporter = nodemailer.createTransport(Object.assign({ jsonTransport: true }, transportBaseOptions));
    transporterType = 'json';
}

// Verify transporter at startup if present
if (sendgridEnabled) {
    // Quick sanity log for SendGrid (no verify() method for HTTP client)
    console.log('Mailer: SendGrid HTTP client is enabled');
} else if (transporter) {
    // Optionally run a TCP probe to the transport host/port to give clearer network-level logs
    (async () => {
        try {
            if (MAIL_DEBUG_NET) {
                const opts = transporter && transporter.options ? transporter.options : {};
                const host = opts.host || (opts.service === 'gmail' ? 'smtp.gmail.com' : undefined);
                const port = opts.port || (opts.service === 'gmail' ? 465 : undefined);
                if (host && port) {
                    console.log(`Mailer: MAIL_DEBUG_NET enabled — probing ${host}:${port}`);
                    const probe = await new Promise((resolve) => {
                        const socket = new net.Socket();
                        let handled = false;
                        const to = setTimeout(() => {
                            if (!handled) { handled = true; socket.destroy(); resolve({ ok: false, reason: 'timeout' }); }
                        }, Math.max(5000, MAIL_CONN_TIMEOUT));
                        socket.once('error', (err) => { if (!handled) { handled = true; clearTimeout(to); resolve({ ok: false, reason: err && err.code ? err.code : String(err) }); } });
                        socket.connect(port, host, () => { if (!handled) { handled = true; clearTimeout(to); socket.end(); resolve({ ok: true }); } });
                    });
                    console.log('Mailer: TCP probe result', probe);
                    pushMailerLog({ type: 'tcp-probe', host, port, result: probe });
                }
            }
        } catch (e) {
            console.warn('Mailer: TCP probe failed', e && e.message ? e.message : e);
        }
    })();

    transporter.verify()
        .then(() => console.log(`Mailer: transporter verified (${transporterType})`))
        .catch(err => {
            // Log full context and push to mailer logs with richer info
            const msg = err && err.message ? err.message : String(err);
            const code = err && err.code ? err.code : undefined;
            const stack = err && err.stack ? err.stack.split('\n').slice(0,3).join(' | ') : undefined;
            console.error('Mailer: transporter verification failed', { message: msg, code, stack });
            pushMailerLog({ type: 'verify', provider: transporterType, ok: false, error: msg, code, stack });

            // Also log attempted transport options (mask credentials)
            try {
                const opts = transporter && transporter.options ? transporter.options : {};
                const masked = Object.assign({}, opts);
                if (masked.auth && masked.auth.pass) masked.auth.pass = '***';
                if (masked.auth && masked.auth.user) masked.auth.user = String(masked.auth.user).replace(/(.{2}).+(.{@?.+})/, '$1***$2');
                console.warn('Mailer: transporter options (masked):', masked);
                pushMailerLog({ type: 'verify', provider: transporterType, ok: false, note: 'transporter-options', options: masked });
            } catch (e) {}

            // Fall back to a safe jsonTransport so the app can continue to run and deliver
            // developer-visible mail content into logs (not real email). This avoids repeated
            // background failures while you configure a working SMTP or SendGrid key.
            try {
                transporter = nodemailer.createTransport(Object.assign({ jsonTransport: true }, transportBaseOptions));
                transporterType = 'json-fallback';
                console.warn('Mailer: falling back to jsonTransport due to verification failure');
                pushMailerLog({ type: 'verify-fallback', provider: transporterType, ok: true, note: 'jsonTransport fallback activated' });
            } catch (e) {
                console.error('Mailer: failed to initialize jsonTransport fallback', e && e.message ? e.message : e);
                pushMailerLog({ type: 'verify-fallback', provider: 'json-fallback', ok: false, error: e && e.message ? e.message : String(e) });
            }
        });
}

// Unified sendEmail helper: uses SendGrid HTTP API when available, otherwise falls back to transporter
async function sendEmail(mailOptions, timeoutMs = 15000) {
    const method = sendgridEnabled ? 'sendgrid-api' : transporterType;
    const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);
    const maxAttempts = 3;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (sendgridEnabled) {
                // Build SendGrid v3 payload
                const payload = {
                    personalizations: [{ to: [{ email: mailOptions.to }] }],
                    from: { email: mailOptions.from || process.env.EMAIL_USER || 'no-reply@flowsec.app' },
                    subject: mailOptions.subject,
                    content: []
                };
                if (mailOptions.text) payload.content.push({ type: 'text/plain', value: mailOptions.text });
                if (mailOptions.html) payload.content.push({ type: 'text/html', value: mailOptions.html });

                const controller = new AbortController();
                const to = setTimeout(() => controller.abort(), timeoutMs);
                const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(to);

                if (resp.ok) {
                    pushMailerLog({ type: 'send', provider: method, to: mailOptions.to, ok: true, info: { status: resp.status } });
                    return { status: resp.status };
                }

                const bodyText = await resp.text().catch(() => 'no-body');
                const status = resp.status;
                pushMailerLog({ type: 'send', provider: method, to: mailOptions.to, ok: false, status, error: bodyText });

                // Retry on 5xx or rate-limit
                if ((status >= 500 || status === 429) && attempt < maxAttempts) {
                    await sleep(500 * attempt);
                    continue;
                }

                throw new Error(`sendgrid error ${status}: ${bodyText}`);
            } else if (transporter) {
                const sendPromise = transporter.sendMail(mailOptions);
                const timeout = new Promise((_, reject) => setTimeout(() => {
                    const e = new Error('mailer timeout'); e.code = 'ETIMEDOUT'; reject(e);
                }, timeoutMs));
                const info = await Promise.race([sendPromise, timeout]);
                pushMailerLog({ type: 'send', provider: method, to: mailOptions.to, ok: true, info: info && (info.messageId || info) });
                return info;
            } else {
                const err = new Error('no-mailer-configured');
                pushMailerLog({ type: 'send', provider: method, to: mailOptions.to, ok: false, error: err.message });
                throw err;
            }
        } catch (err) {
            const code = err && err.code ? err.code : undefined;
            const msg = err && err.message ? err.message : String(err);
            const isTransient = code && transientCodes.has(code) || (err.name === 'AbortError');
            pushMailerLog({ type: 'send', provider: method, to: mailOptions.to, ok: false, error: msg, code, attempt });
            console.error(`Mailer: send attempt ${attempt} failed`, { to: mailOptions.to, code, message: msg });
            if (isTransient && attempt < maxAttempts) {
                await sleep(500 * attempt);
                continue; // retry
            }
            throw err;
        }
    }
}

// Admin debug endpoint: shows current mailer configuration (masked) and status
app.get('/api/mailer-debug', (req, res) => {
    const transportInfo = { transporterType, sendgridEnabled };
    try {
        const opts = transporter && transporter.options ? transporter.options : null;
        if (opts) {
            const masked = Object.assign({}, opts);
            if (masked.auth && masked.auth.pass) masked.auth.pass = '***';
            if (masked.auth && masked.auth.user) masked.auth.user = String(masked.auth.user).replace(/(.{2}).+(.{@?.+})/, '$1***$2');
            transportInfo.options = masked;
        }
    } catch (e) {}
    res.json({ ok: true, transportInfo, logsSample: mailerLogs.slice(0,10) });
});

// In-memory mailer logs (last 50 events) to help debugging delivery
const mailerLogs = [];
function pushMailerLog(event) {
    try {
        mailerLogs.unshift(Object.assign({ time: new Date().toISOString() }, event));
        if (mailerLogs.length > 50) mailerLogs.pop();
    } catch (e) {
        console.error('pushMailerLog error', e && e.message ? e.message : e);
    }
}

// Expose recent mailer logs for quick debugging (not for production)
app.get('/api/mailer-logs', (req, res) => {
    res.json({ logs: mailerLogs });
});

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Temporary in-memory OTP cache for demos/debug (expires after 5 minutes)
const recentOtps = new Map();


// Send OTP endpoint
// Send OTP endpoint — respond quickly and send email asynchronously to avoid request timeouts
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    try {
        console.log('[send-otp] Incoming request', {
            origin: req.headers.origin,
            ip: req.ip || req.connection?.remoteAddress,
            bodySize: req.headers['content-length'] || null,
            timestamp: new Date().toISOString()
        });
    } catch (logErr) {}

    if (!email) return res.status(400).json({ message: 'Email required' });
    const otp = generateOtp();

    // Respond immediately
    res.json({ message: 'OTP sent' });

    // Background work
    (async () => {
        try {
            try {
                await Otp.deleteMany({ email });
                await Otp.create({ email, otp });
                console.log('OTP stored for', email);
                // store in-memory for quick demo access (auto-expire)
                try {
                    recentOtps.set(email, { otp, ts: Date.now() });
                    setTimeout(() => recentOtps.delete(email), 5 * 60 * 1000);
                } catch (e) {}
            } catch (dbErr) {
                console.error('Failed to write OTP to DB for', email, dbErr && dbErr.message ? dbErr.message : dbErr);
            }

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Your OTP for Secure Messenger',
                text: `Your OTP is: ${otp}`,
                html: `<p>Your OTP is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`
            };

            const info = await sendEmail(mailOptions, 15000);
            console.log('OTP email sent to', email, 'info:', info && (info.messageId || JSON.stringify(info)));
        } catch (err) {
            console.error('Failed background tasks for OTP to', email, err && err.message ? err.message : err);
            pushMailerLog({ type: 'otp', to: email, ok: false, error: err && err.message ? err.message : String(err) });
        }
    })();
});

// DEBUG: retrieve last OTP for an email (temporary — remove before production)
app.get('/api/debug-otp', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'email required' });
    const entry = recentOtps.get(email);
    if (!entry) return res.status(404).json({ message: 'No recent OTP found' });
    return res.json({ email, otp: entry.otp, ageMs: Date.now() - entry.ts });
});

// Test email endpoint (use to validate mailer from deployed service)
app.post('/api/test-email', async (req, res) => {
    const to = req.body?.to || process.env.EMAIL_USER;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Test email from Secure Messenger',
        text: 'This is a test email.',
        html: '<p>This is a <strong>test</strong> email.</p>'
    };

    // Respond immediately so requests don't hit Render gateway timeout
    res.json({ ok: true, queued: true });

    // Send email in background with timeout and detailed logging
    (async () => {
        try {
            const info = await sendEmail(mailOptions, 15000);
            console.log('Test email sent to', to, 'info:', info && (info.messageId || JSON.stringify(info)));
        } catch (err) {
            console.error('Test email failed (background)', err && err.message ? err.message : err);
            pushMailerLog({ type: 'test', to, ok: false, error: err && err.message ? err.message : String(err) });
        }
    })();
});

// Synchronous test endpoint: awaits sendMail with timeout and returns result (for debugging only)
app.post('/api/test-email-sync', async (req, res) => {
    const to = req.body?.to || process.env.EMAIL_USER;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: 'Test email (sync) from Secure Messenger',
        text: 'This is a synchronous test email.',
        html: '<p>This is a <strong>synchronous</strong> test email.</p>'
    };

    try {
    // Use unified sendEmail helper with a 12s timeout
    const info = await sendEmail(mailOptions, 12000);
    pushMailerLog({ type: 'test-sync', to, ok: true, info: info && (info.messageId || info) });
    return res.json({ ok: true, messageId: info && info.messageId ? info.messageId : info });
    } catch (err) {
        pushMailerLog({ type: 'test-sync', to, ok: false, error: err && err.message ? err.message : String(err) });
        return res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
    }
});

// Lightweight health check for uptime testing
app.get('/_health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Verify OTP endpoint
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });
    const record = await Otp.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    await Otp.deleteMany({ email }); // Remove OTP after use
    res.json({ message: 'OTP verified' });
});


// --- Messenger API ---



// Create user (signup)
app.post('/api/user', async (req, res) => {
    const { email, username, profileIcon } = req.body;
    if (!email || !username) return res.status(400).json({ message: 'Email and username required' });
    let user = await User.findOne({ $or: [ { email }, { username } ] });
    if (user) return res.status(400).json({ message: 'Email or username already exists' });
    user = await User.create({ email, username, profileIcon });
    res.json({ user });
});

// Get user by email
app.get('/api/user', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// Search user by username
app.get('/api/user-by-username', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'username required' });
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// Search user by messageId
app.get('/api/user-by-messageid', async (req, res) => {
    const { messageId } = req.query;
    if (!messageId) return res.status(400).json({ message: 'messageId required' });
    const user = await User.findOne({ messageId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
});

// List chats for user
app.get('/api/chats', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const chats = await Chat.find({ users: email });
    res.json({ chats });
});

// Create new chat
app.post('/api/chats', async (req, res) => {
    const { users } = req.body; // array of emails
    if (!users || users.length < 2) return res.status(400).json({ message: 'At least 2 users required' });
    const chat = await Chat.create({ users });
    res.json({ chat });
});

// List messages in chat
app.get('/api/messages', async (req, res) => {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ message: 'chatId required' });
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
    res.json({ messages });
});

// Send message (with optional file)
app.post('/api/messages', upload.single('file'), async (req, res) => {
    const { chatId, sender, encrypted } = req.body;
    if (!chatId || !sender || !encrypted) return res.status(400).json({ message: 'chatId, sender, encrypted required' });
    let file = undefined;
    if (req.file) {
        file = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        };
    }
    const message = await Message.create({ chatId, sender, encrypted, file });
    res.json({ message });
});

// Download file
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
