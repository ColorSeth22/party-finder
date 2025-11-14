import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
const { sign } = jwt;

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

const router = Router();

function sanitizeUser(row) {
  return {
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    friend_code: row.friend_code,
    reputation_score: row.reputation_score,
    created_at: row.created_at
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT user_id, email, password_hash, display_name, reputation_score, friend_code, created_at
       FROM Users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = result.rows[0];
    const valid = await compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('[auth/login] Missing JWT_SECRET environment variable');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const token = sign({ user_id: user.user_id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }

    const existing = await pool.query('SELECT user_id FROM Users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await hash(password, SALT_ROUNDS);
    const insert = await pool.query(
      `INSERT INTO Users (email, password_hash, display_name, reputation_score)
       VALUES ($1, $2, $3, 0)
       RETURNING user_id, email, display_name, reputation_score, friend_code, created_at`,
      [email.toLowerCase(), password_hash, display_name || null]
    );
    const user = insert.rows[0];
    if (!process.env.JWT_SECRET) {
      console.error('[auth/register] Missing JWT_SECRET environment variable');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const token = sign({ user_id: user.user_id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error('Register error:', err);
    next(err);
  }
});

export default router;
