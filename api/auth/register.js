import { hash } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { pool } from '../../server/db.js';

// Security constants
const SALT_ROUNDS = 12; // bcrypt cost factor (higher = more secure but slower)
const JWT_EXPIRY = '7d'; // Token expires in 7 days

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  return await new Promise((resolve) => {
    try {
      if (req.body && typeof req.body === 'object') return resolve(req.body);
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({});
        }
      });
      req.on('error', () => resolve({}));
    } catch (e) {
      resolve({});
    }
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 405;
      return res.end('Method Not Allowed');
    }

    const { email, password, display_name } = await readJsonBody(req);

    // Validate input
    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendJson(res, 400, { error: 'Invalid email format' });
    }

    // Validate password strength (min 8 chars, at least one number and one letter)
    if (password.length < 8) {
      return sendJson(res, 400, { error: 'Password must be at least 8 characters' });
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      return sendJson(res, 400, { error: 'Password must contain at least one letter and one number' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM Users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return sendJson(res, 409, { error: 'Email already registered' });
    }

    // Hash password with bcrypt (cost factor 12)
    const password_hash = await hash(password, SALT_ROUNDS);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO Users (email, password_hash, display_name, reputation_score)
       VALUES ($1, $2, $3, 0)
       RETURNING user_id, email, display_name, reputation_score, created_at`,
      [email.toLowerCase(), password_hash, display_name || null]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = sign(
      { 
        user_id: user.user_id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Return user data and token (NEVER return password_hash)
    return sendJson(res, 201, {
      user: {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        reputation_score: user.reputation_score,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Register error:', error);
    return sendJson(res, 500, { error: 'Registration failed' });
  }
};
