import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const query = `SELECT e.event_id AS id, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.start_time, e.end_time, e.tags, e.theme, e.music_type, e.cover_charge, e.is_byob, e.is_active, e.created_by, e.created_at, e.updated_at, f.created_at AS favorited_at FROM Favorites f JOIN Events e ON e.event_id = f.event_id WHERE f.user_id = $1 ORDER BY e.start_time ASC`;
    const result = await pool.query(query, [req.user.user_id]);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const { event_id, favorite } = req.body || {};
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });
    const favoriteIntent = favorite !== false;
    const eventResult = await pool.query('SELECT event_id FROM Events WHERE event_id = $1', [event_id]);
    if (!eventResult.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (!favoriteIntent) {
      await pool.query('DELETE FROM Favorites WHERE user_id = $1 AND event_id = $2', [req.user.user_id, event_id]);
      return res.json({ success: true, favorite: false });
    }
    const insertQuery = `INSERT INTO Favorites (user_id, event_id) VALUES ($1,$2) ON CONFLICT (user_id, event_id) DO NOTHING RETURNING favorite_id, created_at`;
    const result = await pool.query(insertQuery, [req.user.user_id, event_id]);
    if (result.rows.length) {
      await pool.query(`SELECT award_points($1,'favorite_event',$2,$3)`, [req.user.user_id, event_id, JSON.stringify({ event_id })]);
    }
    return res.json({ success: true, favorite: true, favorite_id: result.rows.length ? result.rows[0].favorite_id : null });
  } catch (err) { next(err); }
});

export default router;
