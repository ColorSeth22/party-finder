import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Get user's friends
router.get('/', authRequired, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM get_user_friends($1)', [req.user.user_id]);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

// Send friend request by email or friend code
router.post('/', authRequired, async (req, res, next) => {
  try {
    const { email, code, friend_code } = req.body || {};
    const normalizedEmail = email?.toLowerCase?.();
    const incomingCode = code || friend_code;
    if (!normalizedEmail && !incomingCode) return res.status(400).json({ error: 'Provide an email or friend code' });
    let userResult;
    if (normalizedEmail) {
      userResult = await pool.query('SELECT user_id, email, display_name FROM Users WHERE email = $1', [normalizedEmail]);
    } else {
      userResult = await pool.query('SELECT user_id, email, display_name FROM Users WHERE friend_code = $1', [String(incomingCode).toLowerCase()]);
    }
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const toUser = userResult.rows[0];
    if (toUser.user_id === req.user.user_id) return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    const friendshipCheck = await pool.query('SELECT are_friends($1,$2) as is_friend', [req.user.user_id, toUser.user_id]);
    if (friendshipCheck.rows[0].is_friend) return res.status(400).json({ error: 'Already friends with this user' });
    const pendingCheck = await pool.query(`SELECT 1 FROM FriendRequests WHERE status = 'pending' AND ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)) LIMIT 1`, [req.user.user_id, toUser.user_id]);
    if (pendingCheck.rows.length) return res.status(400).json({ error: 'Friend request already exists' });
    const requestResult = await pool.query(`INSERT INTO FriendRequests (from_user_id, to_user_id, status) VALUES ($1,$2,'pending') RETURNING request_id, from_user_id, to_user_id, status, created_at`, [req.user.user_id, toUser.user_id]);
    return res.status(201).json({ ...requestResult.rows[0], to_user: { email: toUser.email, display_name: toUser.display_name } });
  } catch (err) { next(err); }
});

// Remove friendship
router.delete('/', authRequired, async (req, res, next) => {
  try {
    const { friendshipId } = req.query;
    if (!friendshipId) return res.status(400).json({ error: 'Friendship ID is required' });
    const result = await pool.query('DELETE FROM Friendships WHERE friendship_id = $1 AND (user_id_1 = $2 OR user_id_2 = $2) RETURNING *', [friendshipId, req.user.user_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Friendship not found' });
    return res.json({ message: 'Friend removed successfully' });
  } catch (err) { next(err); }
});

export default router;
