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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      // Get incoming and outgoing friend requests
      const url = new URL(req.url, 'http://localhost');
      const type = url.searchParams.get('type'); // 'incoming', 'outgoing', or undefined for both

      let incomingRequests = [];
      let outgoingRequests = [];

      if (!type || type === 'incoming') {
        const incomingResult = await pool.query(
          `SELECT 
            fr.request_id,
            fr.from_user_id,
            fr.to_user_id,
            fr.status,
            fr.created_at,
            u.email as from_email,
            u.display_name as from_display_name
           FROM FriendRequests fr
           JOIN Users u ON u.user_id = fr.from_user_id
           WHERE fr.to_user_id = $1 AND fr.status = 'pending'
           ORDER BY fr.created_at DESC`,
          [user.user_id]
        );

        incomingRequests = incomingResult.rows.map(row => ({
          request_id: row.request_id,
          from_user_id: row.from_user_id,
          to_user_id: row.to_user_id,
          status: row.status,
          created_at: row.created_at,
          from_user: {
            email: row.from_email,
            display_name: row.from_display_name
          }
        }));
      }

      if (!type || type === 'outgoing') {
        const outgoingResult = await pool.query(
          `SELECT 
            fr.request_id,
            fr.from_user_id,
            fr.to_user_id,
            fr.status,
            fr.created_at,
            u.email as to_email,
            u.display_name as to_display_name
           FROM FriendRequests fr
           JOIN Users u ON u.user_id = fr.to_user_id
           WHERE fr.from_user_id = $1 AND fr.status = 'pending'
           ORDER BY fr.created_at DESC`,
          [user.user_id]
        );

        outgoingRequests = outgoingResult.rows.map(row => ({
          request_id: row.request_id,
          from_user_id: row.from_user_id,
          to_user_id: row.to_user_id,
          status: row.status,
          created_at: row.created_at,
          to_user: {
            email: row.to_email,
            display_name: row.to_display_name
          }
        }));
      }

      return sendJson(res, 200, {
        incoming: incomingRequests,
        outgoing: outgoingRequests
      });
    }

    if (req.method === 'POST') {
      // Accept or reject friend request
      const payload = await readJsonBody(req);
      const { requestId, action } = payload; // action: 'accept' or 'reject'

      if (!requestId || !action) {
        return sendJson(res, 400, { error: 'Request ID and action are required' });
      }

      if (!['accept', 'reject'].includes(action)) {
        return sendJson(res, 400, { error: 'Action must be "accept" or "reject"' });
      }

      // Verify the request is for this user
      const requestResult = await pool.query(
        'SELECT * FROM FriendRequests WHERE request_id = $1 AND to_user_id = $2 AND status = $3',
        [requestId, user.user_id, 'pending']
      );

      if (requestResult.rows.length === 0) {
        return sendJson(res, 404, { error: 'Friend request not found' });
      }

      const friendRequest = requestResult.rows[0];

      if (action === 'accept') {
        // Create friendship
        await pool.query(
          'INSERT INTO Friendships (user_id_1, user_id_2) VALUES ($1, $2)',
          [friendRequest.from_user_id, friendRequest.to_user_id]
        );

        // Update request status
        await pool.query(
          "UPDATE FriendRequests SET status = 'accepted' WHERE request_id = $1",
          [requestId]
        );

        return sendJson(res, 200, { message: 'Friend request accepted' });
      } else {
        // Reject request
        await pool.query(
          "UPDATE FriendRequests SET status = 'rejected' WHERE request_id = $1",
          [requestId]
        );

        return sendJson(res, 200, { message: 'Friend request rejected' });
      }
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Friend requests API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
