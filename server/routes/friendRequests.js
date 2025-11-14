import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// List incoming/outgoing pending friend requests
router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { type } = req.query; // 'incoming' | 'outgoing' | undefined
    let incoming = []; let outgoing = [];
    if (!type || type === 'incoming') {
      const incomingResult = await pool.query(`SELECT fr.request_id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at, u.email as from_email, u.display_name as from_display_name
                                               FROM FriendRequests fr JOIN Users u ON u.user_id = fr.from_user_id
                                               WHERE fr.to_user_id = $1 AND fr.status = 'pending'
                                               ORDER BY fr.created_at DESC`, [userId]);
      incoming = incomingResult.rows.map(r => ({ request_id: r.request_id, from_user_id: r.from_user_id, to_user_id: r.to_user_id, status: r.status, created_at: r.created_at, from_user: { email: r.from_email, display_name: r.from_display_name } }));
    }
    if (!type || type === 'outgoing') {
      const outgoingResult = await pool.query(`SELECT fr.request_id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at, u.email as to_email, u.display_name as to_display_name
                                               FROM FriendRequests fr JOIN Users u ON u.user_id = fr.to_user_id
                                               WHERE fr.from_user_id = $1 AND fr.status = 'pending'
                                               ORDER BY fr.created_at DESC`, [userId]);
      outgoing = outgoingResult.rows.map(r => ({ request_id: r.request_id, from_user_id: r.from_user_id, to_user_id: r.to_user_id, status: r.status, created_at: r.created_at, to_user: { email: r.to_email, display_name: r.to_display_name } }));
    }
    return res.json({ incoming, outgoing });
  } catch (err) { next(err); }
});

// Accept or reject a friend request
router.post('/', authRequired, async (req, res, next) => {
  try {
    const { requestId, action } = req.body || {}; // action: 'accept' | 'reject'
    if (!requestId || !action) return res.status(400).json({ error: 'Request ID and action are required' });
    if (!['accept','reject'].includes(action)) return res.status(400).json({ error: 'Action must be "accept" or "reject"' });
    const requestResult = await pool.query('SELECT * FROM FriendRequests WHERE request_id = $1 AND to_user_id = $2 AND status = $3', [requestId, req.user.user_id, 'pending']);
    if (!requestResult.rows.length) return res.status(404).json({ error: 'Friend request not found' });
    const fr = requestResult.rows[0];
    if (action === 'accept') {
      await pool.query('INSERT INTO Friendships (user_id_1, user_id_2) VALUES ($1,$2)', [fr.from_user_id, fr.to_user_id]);
      await pool.query("UPDATE FriendRequests SET status = 'accepted' WHERE request_id = $1", [requestId]);
      return res.json({ message: 'Friend request accepted' });
    } else {
      await pool.query("UPDATE FriendRequests SET status = 'rejected' WHERE request_id = $1", [requestId]);
      return res.json({ message: 'Friend request rejected' });
    }
  } catch (err) { next(err); }
});

export default router;
