import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = Router();

// Secret key — in production, use an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'bingo-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d';

// ── Middleware: verify JWT ──────────────────────────────────────────

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Optional auth — attaches user if token present, but doesn't reject
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            // Token invalid, just continue without user
        }
    }
    next();
}

// ── POST /api/auth/signup ───────────────────────────────────────────

router.post('/signup', async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = db.prepare(
            'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)'
        ).run(email, username, passwordHash);

        const token = jwt.sign(
            { id: result.lastInsertRowid, email, username },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.status(201).json({
            token,
            user: { id: result.lastInsertRowid, email, username }
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// ── POST /api/auth/login ────────────────────────────────────────────

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
        token,
        user: { id: user.id, email: user.email, username: user.username }
    });
});

// ── GET /api/auth/me ────────────────────────────────────────────────

router.get('/me', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

export default router;
