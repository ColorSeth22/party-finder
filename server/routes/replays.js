import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired, authOptional } from '../middleware/auth.js';

const router = Router();

// List replays with visibility filters
router.get('/', authOptional, async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    const { visibility, limit, offset } = req.query;
    const lim = Number(limit) || 20;
    const off = Number(offset) || 0;

    let query;
    const values = [lim, off];

    if (visibility === 'my' && userId) {
      query = `SELECT r.*, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.theme, e.tags, e.created_by, e.average_rating, e.rating_count, u.display_name as host_name
               FROM EventReplays r
               JOIN Events e ON r.event_id = e.event_id
               JOIN Users u ON e.created_by = u.user_id
               WHERE e.created_by = $3
               ORDER BY r.archived_at DESC
               LIMIT $1 OFFSET $2`;
      values.push(userId);
    } else if (visibility === 'friends' && userId) {
      query = `SELECT r.*, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.theme, e.tags, e.created_by, e.average_rating, e.rating_count, u.display_name as host_name
               FROM EventReplays r
               JOIN Events e ON r.event_id = e.event_id
               JOIN Users u ON e.created_by = u.user_id
               WHERE (r.replay_visibility = 'everyone' OR (r.replay_visibility = 'friends' AND EXISTS (
                       SELECT 1 FROM Friendships f
                       WHERE (f.user1_id = $3 AND f.user2_id = e.created_by) OR (f.user2_id = $3 AND f.user1_id = e.created_by)
               )))
               AND (EXISTS (
                       SELECT 1 FROM Friendships f
                       WHERE (f.user1_id = $3 AND f.user2_id = e.created_by) OR (f.user2_id = $3 AND f.user1_id = e.created_by)
               ))
               ORDER BY r.archived_at DESC
               LIMIT $1 OFFSET $2`;
      values.push(userId);
    } else {
      if (userId) {
        query = `SELECT r.*, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.theme, e.tags, e.created_by, e.average_rating, e.rating_count, u.display_name as host_name
                 FROM EventReplays r
                 JOIN Events e ON r.event_id = e.event_id
                 JOIN Users u ON e.created_by = u.user_id
                 WHERE r.replay_visibility = 'everyone' OR e.created_by = $3
                 ORDER BY r.archived_at DESC
                 LIMIT $1 OFFSET $2`;
        values.push(userId);
      } else {
        query = `SELECT r.*, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.theme, e.tags, e.created_by, e.average_rating, e.rating_count, u.display_name as host_name
                 FROM EventReplays r
                 JOIN Events e ON r.event_id = e.event_id
                 JOIN Users u ON e.created_by = u.user_id
                 WHERE r.replay_visibility = 'everyone'
                 ORDER BY r.archived_at DESC
                 LIMIT $1 OFFSET $2`;
      }
    }

    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

// Get single replay
router.get('/:id', authOptional, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id;
    const query = `SELECT r.*, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.start_time, e.end_time, e.theme, e.music_type, e.cover_charge, e.tags, e.created_by, e.average_rating, e.rating_count, u.display_name as host_name, u.friend_code as host_friend_code
                   FROM EventReplays r
                   JOIN Events e ON r.event_id = e.event_id
                   JOIN Users u ON e.created_by = u.user_id
                   WHERE r.replay_id = $1`;
    const result = await pool.query(query, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Replay not found' });
    const replay = result.rows[0];
    if (replay.created_by !== userId) {
      if (replay.replay_visibility === 'private') return res.status(403).json({ error: 'This replay is private' });
      if (replay.replay_visibility === 'friends') {
        if (!userId) return res.status(403).json({ error: 'This replay is friends-only' });
        const friendCheck = await pool.query(`SELECT 1 FROM Friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user2_id = $1 AND user1_id = $2)`, [userId, replay.created_by]);
        if (!friendCheck.rows.length) return res.status(403).json({ error: 'This replay is friends-only' });
      }
    }
    const ratingsResult = await pool.query(`SELECT rating, COUNT(*) as count, array_agg(DISTINCT unnest(feedback_tags)) FILTER (WHERE feedback_tags IS NOT NULL) as all_feedback_tags FROM EventRatings WHERE event_id = $1 GROUP BY rating ORDER BY rating DESC`, [replay.event_id]);
    replay.ratings_breakdown = ratingsResult.rows;
    return res.json(replay);
  } catch (err) { next(err); }
});

// Update replay (host only)
router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const ownerCheck = await pool.query(`SELECT e.created_by FROM EventReplays r JOIN Events e ON r.event_id = e.event_id WHERE r.replay_id = $1`, [id]);
    if (!ownerCheck.rows.length) return res.status(404).json({ error: 'Replay not found' });
    if (ownerCheck.rows[0].created_by !== userId) return res.status(403).json({ error: 'Only the event host can update the replay' });
    const updates = req.body || {};
    const allowed = ['host_notes','highlight_photos','replay_visibility'];
    const fields = Object.keys(updates).filter(f => allowed.includes(f));
    if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
    const setters = []; const values = [];
    for (const key of fields) {
      if (key === 'replay_visibility' && !['everyone','friends','private'].includes(updates[key])) return res.status(400).json({ error: 'replay_visibility must be everyone, friends, or private' });
      if (key === 'highlight_photos' && !Array.isArray(updates[key])) return res.status(400).json({ error: 'highlight_photos must be an array of URLs' });
      setters.push(`${key} = $${setters.length+1}`);
      values.push(updates[key]);
    }
    values.push(id);
    const updateQuery = `UPDATE EventReplays SET ${setters.join(', ')} WHERE replay_id = $${values.length} RETURNING *`;
    const result = await pool.query(updateQuery, values);
    return res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
