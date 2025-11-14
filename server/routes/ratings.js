import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/', authRequired, async (req, res, next) => {
  try {
    const { event_id, rating, feedback_tags, review_text } = req.body || {};
    const userId = req.user.user_id;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });
    const eventCheck = await pool.query('SELECT is_archived FROM Events WHERE event_id = $1', [event_id]);
    if (!eventCheck.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (!eventCheck.rows[0].is_archived) return res.status(400).json({ error: 'Can only rate archived events' });
    const checkinCheck = await pool.query('SELECT 1 FROM CheckIns WHERE event_id = $1 AND user_id = $2 LIMIT 1', [event_id, userId]);
    if (!checkinCheck.rows.length) return res.status(403).json({ error: 'Can only rate events you attended' });
    const result = await pool.query(`INSERT INTO EventRatings (event_id, user_id, rating, feedback_tags, review_text)
                                     VALUES ($1,$2,$3,$4,$5)
                                     ON CONFLICT (event_id, user_id) DO UPDATE
                                     SET rating = EXCLUDED.rating, feedback_tags = EXCLUDED.feedback_tags, review_text = EXCLUDED.review_text
                                     RETURNING *`, [event_id, userId, rating, feedback_tags || null, review_text || null]);
    await pool.query(`SELECT award_points($1,'rate_event',$2,$3)`, [userId, event_id, JSON.stringify({ rating })]);
    return res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
