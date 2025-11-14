import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { pool } from '../../utils/db.js';

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

    const { email, password } = await readJsonBody(req);

    // Validate input
    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required' });
    }

    // Find user by email
    const result = await pool.query(
      `SELECT user_id, email, password_hash, display_name, reputation_score, friend_code, created_at
       FROM Users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal whether email exists (security best practice)
      return sendJson(res, 401, { error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password using bcrypt
    const isValidPassword = await compare(password, user.password_hash);

    if (!isValidPassword) {
      return sendJson(res, 401, { error: 'Invalid email or password' });
    }

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
    return sendJson(res, 200, {
      user: {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        friend_code: user.friend_code,
        reputation_score: user.reputation_score,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return sendJson(res, 500, { error: 'Login failed' });
  }
};
