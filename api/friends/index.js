import { pool } from '../../utils/db.js';
import { requireAuth } from '../../utils/auth.js';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  return await new Promise((resolve, reject) => {
    try {
      if (req.body && typeof req.body === 'object') return resolve(req.body);
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

export default async function handler(req, res) {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return sendJson(res, 200, {});
    }

    if (!process.env.DATABASE_URL) {
      return sendJson(res, 500, {
        error: 'Database not configured',
        detail: 'Missing DATABASE_URL. Set it in .env or project env variables.'
      });
    }

    const authResult = await requireAuth(req);
    if (authResult.error) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }

    const user = authResult.user;

    if (req.method === 'GET') {
      // Get user's friends
      const result = await pool.query(
        'SELECT * FROM get_user_friends($1)',
        [user.user_id]
      );

      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      // Send friend request by email or friend code
      const payload = await readJsonBody(req);
      const email = payload?.email?.toLowerCase?.();
      const friendCode = payload?.code || payload?.friend_code;

      if (!email && !friendCode) {
        return sendJson(res, 400, { error: 'Provide an email or friend code' });
      }

      // Find the user by email or code
      let userResult;
      if (email) {
        userResult = await pool.query(
          'SELECT user_id, email, display_name FROM Users WHERE email = $1',
          [email]
        );
      } else {
        userResult = await pool.query(
          'SELECT user_id, email, display_name FROM Users WHERE friend_code = $1',
          [String(friendCode).toLowerCase()]
        );
      }

      if (userResult.rows.length === 0) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      const toUser = userResult.rows[0];

      if (toUser.user_id === user.user_id) {
        return sendJson(res, 400, { error: 'Cannot send friend request to yourself' });
      }

      // Check if already friends
      const friendshipCheck = await pool.query(
        'SELECT are_friends($1, $2) as is_friend',
        [user.user_id, toUser.user_id]
      );

      if (friendshipCheck.rows[0].is_friend) {
        return sendJson(res, 400, { error: 'Already friends with this user' });
      }

      // Block only if a pending request exists between the pair (in any direction)
      const existingPending = await pool.query(
        `SELECT 1 FROM FriendRequests 
         WHERE status = 'pending' AND (
           (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
         ) LIMIT 1`,
        [user.user_id, toUser.user_id]
      );

      if (existingPending.rows.length > 0) {
        return sendJson(res, 400, { error: 'Friend request already exists' });
      }

      // Create friend request
      const requestResult = await pool.query(
        `INSERT INTO FriendRequests (from_user_id, to_user_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING request_id, from_user_id, to_user_id, status, created_at`,
        [user.user_id, toUser.user_id]
      );

      return sendJson(res, 201, {
        ...requestResult.rows[0],
        to_user: {
          email: toUser.email,
          display_name: toUser.display_name
        }
      });
    }

    if (req.method === 'DELETE') {
      // Remove friend - get friendshipId from query params
      const url = new URL(req.url, 'http://localhost');
      const friendshipId = url.searchParams.get('friendshipId');

      if (!friendshipId) {
        return sendJson(res, 400, { error: 'Friendship ID is required' });
      }

      // Verify the friendship belongs to the user
      const result = await pool.query(
        'DELETE FROM Friendships WHERE friendship_id = $1 AND (user_id_1 = $2 OR user_id_2 = $2) RETURNING *',
        [friendshipId, user.user_id]
      );

      if (result.rows.length === 0) {
        return sendJson(res, 404, { error: 'Friendship not found' });
      }

      return sendJson(res, 200, { message: 'Friend removed successfully' });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Friends API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
