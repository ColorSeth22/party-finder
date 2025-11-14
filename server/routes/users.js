import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired, authOptional } from '../middleware/auth.js';

const router = Router();

// Get user profile (self if :id omitted and authenticated)
router.get('/:id', authOptional, async (req, res, next) => {
  try {
    let id = req.params.id;
    if (!id) {
      if (req.user) id = req.user.user_id; else return res.status(401).json({ error: 'User ID required or authentication needed' });
    }
    const userQuery = `SELECT user_id, email, display_name, reputation_score, created_at FROM Users WHERE user_id = $1`;
    const userResult = await pool.query(userQuery, [id]);
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const [eventsCreated, upcomingEvents, checkinsMade, favoritesSaved] = await Promise.all([
      pool.query('SELECT COUNT(*)::INT AS count FROM Events WHERE created_by = $1', [id]),
      pool.query('SELECT COUNT(*)::INT AS count FROM Events WHERE created_by = $1 AND start_time >= NOW()', [id]),
      pool.query('SELECT COUNT(*)::INT AS count FROM CheckIns WHERE user_id = $1', [id]),
      pool.query('SELECT COUNT(*)::INT AS count FROM Favorites WHERE user_id = $1', [id])
    ]);
    const activitiesQuery = `SELECT ua.activity_id, ua.activity_type, ua.points_earned, ua.created_at, ua.metadata, ua.event_id, e.title AS event_title, e.start_time FROM UserActivities ua LEFT JOIN Events e ON ua.event_id = e.event_id WHERE ua.user_id = $1 ORDER BY ua.created_at DESC LIMIT 20`;
    const activitiesResult = await pool.query(activitiesQuery, [id]);
    return res.json({ user: { user_id: user.user_id, email: user.email, display_name: user.display_name, reputation_score: user.reputation_score, created_at: user.created_at }, stats: { events_created: eventsCreated.rows[0].count, upcoming_events_hosting: upcomingEvents.rows[0].count, checkins_made: checkinsMade.rows[0].count, favorites_saved: favoritesSaved.rows[0].count, total_contributions: eventsCreated.rows[0].count + checkinsMade.rows[0].count + favoritesSaved.rows[0].count }, recent_activities: activitiesResult.rows.map(a => ({ activity_id: a.activity_id, type: a.activity_type, points: a.points_earned, created_at: a.created_at, event: a.event_id ? { id: a.event_id, title: a.event_title, start_time: a.start_time } : null, metadata: a.metadata })) });
  } catch (err) { next(err); }
});

// Data collection preference
router.get('/data-collection', authRequired, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT allow_data_collection FROM Users WHERE user_id = $1', [req.user.user_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ allow_data_collection: result.rows[0].allow_data_collection || false });
  } catch (err) { next(err); }
});

router.put('/data-collection', authRequired, async (req, res, next) => {
  try {
    const { allow_data_collection } = req.body || {};
    if (typeof allow_data_collection !== 'boolean') return res.status(400).json({ error: 'allow_data_collection must be a boolean' });
    const result = await pool.query('UPDATE Users SET allow_data_collection = $1 WHERE user_id = $2 RETURNING allow_data_collection', [allow_data_collection, req.user.user_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, allow_data_collection: result.rows[0].allow_data_collection });
  } catch (err) { next(err); }
});

export default router;
