import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT event_id, checked_in_at FROM CheckIns WHERE user_id = $1 ORDER BY checked_in_at DESC', [req.user.user_id]);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const { event_id } = req.body || {};
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    const eventResult = await pool.query('SELECT event_id FROM Events WHERE event_id = $1 AND is_active = true', [event_id]);
    if (!eventResult.rows.length) return res.status(404).json({ error: 'Event not found or inactive' });
    const insertQuery = `INSERT INTO CheckIns (user_id, event_id) VALUES ($1,$2) ON CONFLICT (user_id, event_id) DO UPDATE SET checked_in_at = NOW() RETURNING checkin_id, user_id, event_id, checked_in_at`;
    const result = await pool.query(insertQuery, [req.user.user_id, event_id]);
    await pool.query(`SELECT award_points($1,'check_in',$2,$3)`, [req.user.user_id, event_id, JSON.stringify({ event_id })]);
    return res.json({ success: true, checkin: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
