import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired, authOptional } from '../middleware/auth.js';

const router = Router();

function buildFilters(query) {
  const hostType = query.host_type;
  const isActive = query.is_active;
  const startAfter = query.start_after;
  const startBefore = query.start_before;
  return {
    hostType: hostType && ['fraternity', 'house', 'club'].includes(hostType) ? hostType : null,
    isActive: isActive === undefined ? null : isActive !== 'false',
    startAfter: startAfter ? new Date(startAfter) : null,
    startBefore: startBefore ? new Date(startBefore) : null
  };
}

router.get('/', async (req, res, next) => {
  try {
    const filters = buildFilters(req.query);
    const includeArchived = req.query.include_archived === 'true';
    const conditions = [];
    if (!includeArchived) conditions.push('is_archived = false');
    const values = [];
    if (filters.hostType) { values.push(filters.hostType); conditions.push(`host_type = $${values.length}`); }
    if (filters.isActive !== null) { values.push(filters.isActive); conditions.push(`is_active = $${values.length}`); }
    if (filters.startAfter && !Number.isNaN(filters.startAfter.valueOf())) { values.push(filters.startAfter.toISOString()); conditions.push(`start_time >= $${values.length}`); }
    if (filters.startBefore && !Number.isNaN(filters.startBefore.valueOf())) { values.push(filters.startBefore.toISOString()); conditions.push(`start_time <= $${values.length}`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT e.event_id AS id, e.title, e.description, e.host_type, e.location_lat, e.location_lng, e.start_time, e.end_time, e.tags, e.theme, e.music_type, e.cover_charge, e.is_byob, e.is_active, e.created_by, e.created_by AS user_id, e.visibility, e.created_at, e.is_archived, e.archived_at, (SELECT COUNT(*) FROM CheckIns WHERE event_id = e.event_id) AS checkin_count FROM Events e ${whereClause} ORDER BY e.start_time ASC`;
    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

// Archived events listing (placed BEFORE param route to avoid treating 'archived' as :id)
router.get('/archived', authRequired, async (req, res, next) => {
  try {
    const role = req.query.role === 'attended' ? 'attended' : 'host';
    const userId = req.query.user_id || req.user.user_id;
    if (role === 'host') {
      const q = `SELECT e.event_id AS id, e.title, e.description, e.host_type, e.location_lat, e.location_lng,
        e.start_time, e.end_time, e.tags, e.theme, e.music_type, e.cover_charge, e.is_byob, e.is_active,
        e.created_by, e.created_by AS user_id, e.visibility, e.created_at, e.is_archived, e.archived_at,
        (SELECT COUNT(*) FROM CheckIns WHERE event_id = e.event_id) AS checkin_count,
        (SELECT COUNT(*) FROM EventMedia WHERE event_id = e.event_id) AS media_count,
        (SELECT AVG(rating) FROM EventRatings WHERE event_id = e.event_id) AS avg_rating
        FROM Events e WHERE e.created_by = $1 AND e.is_archived = true ORDER BY e.archived_at DESC NULLS LAST`; 
      const result = await pool.query(q, [userId]);
      return res.json(result.rows);
    } else {
      const q = `SELECT e.event_id AS id, e.title, e.description, e.host_type, e.location_lat, e.location_lng,
        e.start_time, e.end_time, e.tags, e.theme, e.music_type, e.cover_charge, e.is_byob, e.is_active,
        e.created_by, e.created_by AS user_id, e.visibility, e.created_at, e.is_archived, e.archived_at,
        (SELECT COUNT(*) FROM CheckIns WHERE event_id = e.event_id) AS checkin_count,
        (SELECT COUNT(*) FROM EventMedia WHERE event_id = e.event_id) AS media_count,
        (SELECT AVG(rating) FROM EventRatings WHERE event_id = e.event_id) AS avg_rating
        FROM Events e
        JOIN CheckIns c ON c.event_id = e.event_id
        WHERE c.user_id = $1 AND e.is_archived = true
        GROUP BY e.event_id
        ORDER BY e.archived_at DESC NULLS LAST`;
      const result = await pool.query(q, [userId]);
      return res.json(result.rows);
    }
  } catch (err) { next(err); }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const payload = req.body || {};
    const required = ['title', 'host_type', 'location_lat', 'location_lng', 'start_time'];
    for (const f of required) { if (payload[f] === undefined || payload[f] === null || payload[f] === '') return res.status(400).json({ error: `Missing required field: ${f}` }); }
    const hostType = String(payload.host_type);
    if (!['fraternity', 'house', 'club'].includes(hostType)) return res.status(400).json({ error: 'host_type must be one of fraternity, house, club' });
    const startTime = new Date(payload.start_time); if (Number.isNaN(startTime.valueOf())) return res.status(400).json({ error: 'Invalid start_time value' });
    let endTime = null; if (payload.end_time) { const parsed = new Date(payload.end_time); if (Number.isNaN(parsed.valueOf())) return res.status(400).json({ error: 'Invalid end_time value' }); endTime = parsed.toISOString(); }
    const latitude = Number(payload.location_lat); const longitude = Number(payload.location_lng); if (Number.isNaN(latitude) || Number.isNaN(longitude)) return res.status(400).json({ error: 'location_lat and location_lng must be numbers' });
    const tags = Array.isArray(payload.tags) ? payload.tags.map(t => String(t).trim()).filter(Boolean) : [];
    const visibility = payload.visibility && ['everyone', 'friends'].includes(payload.visibility) ? payload.visibility : 'everyone';
    const insertQuery = `INSERT INTO Events (title, description, host_type, location_lat, location_lng, start_time, end_time, tags, theme, music_type, cover_charge, is_byob, is_active, created_by, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),$13,$14,$15) RETURNING event_id AS id, title, description, host_type, location_lat, location_lng, start_time, end_time, tags, theme, music_type, cover_charge, is_byob, is_active, created_by, created_by AS user_id, visibility, created_at`;
    const values = [payload.title, payload.description || null, hostType, latitude, longitude, startTime.toISOString(), endTime, tags, payload.theme || null, payload.music_type || null, payload.cover_charge || null, typeof payload.is_byob === 'boolean' ? payload.is_byob : null, payload.is_active !== false, req.user.user_id, visibility];
    const result = await pool.query(insertQuery, values);
    await pool.query(`SELECT award_points($1,'add_event',$2,$3)`, [req.user.user_id, result.rows[0].id, JSON.stringify({ event_title: payload.title })]);
    return res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT event_id AS id, title, description, host_type, location_lat, location_lng, start_time, end_time, tags, theme, music_type, cover_charge, is_byob, is_active, created_by, created_by AS user_id, visibility, created_at, is_archived, archived_at FROM Events WHERE event_id = $1`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    return res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT event_id, created_by FROM Events WHERE event_id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].created_by !== req.user.user_id) return res.status(403).json({ error: 'Only the event owner can update this event' });
    const updates = req.body || {};
    const editable = new Set(['title','description','host_type','location_lat','location_lng','start_time','end_time','tags','theme','music_type','cover_charge','is_byob','is_active','visibility']);
    const fields = Object.keys(updates).filter(k => editable.has(k));
    if (!fields.length) return res.status(400).json({ error: 'No supported fields provided for update' });
    const setters = []; const values = [];
    for (const key of fields) {
      if (key === 'host_type' && !['fraternity','house','club'].includes(updates[key])) return res.status(400).json({ error: 'host_type must be one of fraternity, house, club' });
      if (key === 'visibility' && !['everyone','friends'].includes(updates[key])) return res.status(400).json({ error: 'visibility must be one of everyone, friends' });
      if ((key === 'start_time' || key === 'end_time') && updates[key]) { const d = new Date(updates[key]); if (Number.isNaN(d.valueOf())) return res.status(400).json({ error: `Invalid date provided for ${key}` }); setters.push(`${key} = $${setters.length+1}`); values.push(d.toISOString()); continue; }
      if (key === 'tags') { if (!Array.isArray(updates.tags)) return res.status(400).json({ error: 'tags must be an array of strings' }); setters.push('tags = $' + (setters.length+1)); values.push(updates.tags.map(t=>String(t).trim()).filter(Boolean)); continue; }
      if (key === 'location_lat' || key === 'location_lng') { const num = Number(updates[key]); if (Number.isNaN(num)) return res.status(400).json({ error: `${key} must be a number` }); setters.push(`${key} = $${setters.length+1}`); values.push(num); continue; }
      if (key === 'is_byob' || key === 'is_active') { setters.push(`${key} = $${setters.length+1}`); values.push(Boolean(updates[key])); continue; }
      setters.push(`${key} = $${setters.length+1}`); values.push(updates[key]);
    }
    values.push(id);
    const updateQuery = `UPDATE Events SET ${setters.join(', ')}, updated_at = NOW() WHERE event_id = $${values.length} RETURNING event_id AS id, title, description, host_type, location_lat, location_lng, start_time, end_time, tags, theme, music_type, cover_charge, is_byob, is_active, created_by, created_at, is_archived, archived_at`;
    const result = await pool.query(updateQuery, values);
    await pool.query(`SELECT award_points($1,'edit_event',$2,$3)`, [req.user.user_id, id, JSON.stringify({ updated_fields: fields })]);
    return res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT event_id, created_by FROM Events WHERE event_id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].created_by !== req.user.user_id) return res.status(403).json({ error: 'Only the event owner can delete this event' });
    await pool.query('DELETE FROM Events WHERE event_id = $1', [id]);
    return res.json({ message: 'Event deleted' });
  } catch (err) { next(err); }
});

async function archiveOrEnd(req, res, next, endOnly) {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const eventCheck = await pool.query('SELECT created_by, is_archived FROM Events WHERE event_id = $1', [id]);
    if (!eventCheck.rows.length) return res.status(404).json({ error: 'Event not found' });
    const ev = eventCheck.rows[0];
    if (ev.created_by !== userId) return res.status(403).json({ error: `Only the event host can ${endOnly ? 'end' : 'archive'} the event` });
    if (ev.is_archived) return res.status(400).json({ error: `Event is already ${endOnly ? 'ended' : 'archived'}` });
    const updateSql = endOnly ? 'UPDATE Events SET is_active = false, is_archived = true, archived_at = NOW() WHERE event_id = $1' : 'UPDATE Events SET is_archived = true, archived_at = NOW() WHERE event_id = $1';
    await pool.query(updateSql, [id]);
    const replayResult = await pool.query('SELECT generate_event_replay($1) as replay_id', [id]);
    await pool.query('SELECT check_and_award_badges($1)', [userId]);
    return res.json({ message: endOnly ? 'Event ended successfully' : 'Event archived successfully', replay_id: replayResult.rows[0].replay_id });
  } catch (err) { next(err); }
}

router.post('/:id/archive', authRequired, (req, res, next) => archiveOrEnd(req, res, next, false));
router.post('/:id/end', authRequired, (req, res, next) => archiveOrEnd(req, res, next, true));

export default router;
