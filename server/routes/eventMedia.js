import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

// Merge with events base path; media endpoints nested under /api/events/:id

// Archived events listing (host perspective or attendee perspective)
// GET /api/events/archived?user_id=<uuid>&role=host|attended
// MUST BE FIRST to avoid being captured by /:id routes
router.get('/archived', authRequired, async (req, res, next) => {
  try {
    const role = req.query.role === 'attended' ? 'attended' : 'host';
    const userId = req.query.user_id || req.user.user_id;
    if (role === 'host') {
      const rows = await pool.query(`SELECT e.event_id AS id, e.title, e.start_time, e.end_time, e.archived_at,
        (SELECT COUNT(*) FROM EventMedia m WHERE m.event_id = e.event_id) AS media_count,
        (SELECT AVG(rating) FROM EventRatings r WHERE r.event_id = e.event_id) AS avg_rating
        FROM Events e WHERE e.created_by = $1 AND e.is_archived = true ORDER BY e.archived_at DESC NULLS LAST`, [userId]);
      return res.json(rows.rows);
    } else {
      const rows = await pool.query(`SELECT e.event_id AS id, e.title, e.start_time, e.end_time, e.archived_at,
        (SELECT COUNT(*) FROM EventMedia m WHERE m.event_id = e.event_id) AS media_count,
        (SELECT AVG(rating) FROM EventRatings r WHERE r.event_id = e.event_id) AS avg_rating
        FROM Events e
        JOIN CheckIns c ON c.event_id = e.event_id
        WHERE c.user_id = $1 AND e.is_archived = true
        GROUP BY e.event_id
        ORDER BY e.archived_at DESC NULLS LAST`, [userId]);
      return res.json(rows.rows);
    }
  } catch (err) { next(err); }
});

router.get('/:id/media', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ev = await pool.query('SELECT event_id, is_archived FROM Events WHERE event_id = $1', [id]);
    if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (!ev.rows[0].is_archived) return res.status(400).json({ error: 'Media only available for archived events' });
    const media = await pool.query('SELECT media_id, media_type, mime_type, file_size, caption, user_id, created_at FROM EventMedia WHERE event_id = $1 ORDER BY created_at ASC', [id]);
    return res.json(media.rows);
  } catch (err) { next(err); }
});

// GET /api/events/:id/media/:mediaId/file - Serve media file from database
router.get('/:id/media/:mediaId/file', async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    const media = await pool.query('SELECT media_data, mime_type FROM EventMedia WHERE media_id = $1 AND event_id = $2', [mediaId, id]);
    if (!media.rows.length) return res.status(404).json({ error: 'Media not found' });
    
    const { media_data, mime_type } = media.rows[0];
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    return res.send(media_data);
  } catch (err) { next(err); }
});

router.post('/:id/media', authRequired, (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err) return next(err);
    try {
      const { id } = req.params;
      const userId = req.user.user_id;
      const ev = await pool.query('SELECT event_id, created_by, is_archived FROM Events WHERE event_id = $1', [id]);
      if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });
      const event = ev.rows[0];
      if (!event.is_archived) return res.status(400).json({ error: 'Event must be archived to post media' });
      // Must be host or checked-in attendee
      const check = await pool.query('SELECT 1 FROM CheckIns WHERE event_id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
      if (event.created_by !== userId && !check.rows.length) return res.status(403).json({ error: 'Only host or attendees can upload media' });
      if (!req.file) return res.status(400).json({ error: 'media file required (field name: media)' });
      // Per-event and per-user limits to reduce spam
      const totalCountResult = await pool.query('SELECT COUNT(*)::INT AS count FROM EventMedia WHERE event_id = $1', [id]);
      if (totalCountResult.rows[0].count >= 50) return res.status(400).json({ error: 'Media limit reached for this event (50 max)' });
      const userCountResult = await pool.query('SELECT COUNT(*)::INT AS count FROM EventMedia WHERE event_id = $1 AND user_id = $2', [id, userId]);
      if (userCountResult.rows[0].count >= 10) return res.status(400).json({ error: 'You have reached your upload limit (10) for this event' });

      // Basic mime / extension guard (multer already filtered mimetype)
      const originalName = req.file.originalname || '';
      const lowered = originalName.toLowerCase();
      const forbiddenExt = ['.exe','.js','.sh','.bat','.cmd','.php','.py'];
      if (forbiddenExt.some(ext => lowered.endsWith(ext))) return res.status(400).json({ error: 'File type not allowed' });

      // Sanitize caption: allow letters, numbers, spaces & . , ! ? - _ # @
      const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      let caption = (req.body && req.body.caption) ? String(req.body.caption).slice(0, 200) : null;
      if (caption) {
        caption = caption.replace(/[^a-zA-Z0-9 \.,!?#@_\-]/g, '').trim();
        if (!caption.length) caption = null;
      }
      
      // Store binary data in database
      const mediaData = req.file.buffer; // Multer provides buffer with memoryStorage
      const mimeType = req.file.mimetype;
      const fileSize = req.file.size;
      
      const ins = await pool.query(
        'INSERT INTO EventMedia (event_id, user_id, media_type, media_data, mime_type, file_size, caption) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING media_id, media_type, mime_type, file_size, caption, user_id, created_at',
        [id, userId, mediaType, mediaData, mimeType, fileSize, caption]
      );
      return res.status(201).json(ins.rows[0]);
    } catch (e) { next(e); }
  });
});

// DELETE /api/events/:id/media/:mediaId - Host can delete media
router.delete('/:id/media/:mediaId', authRequired, async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    const userId = req.user.user_id;
    
    // Verify event exists and user is the host
    const ev = await pool.query('SELECT event_id, created_by FROM Events WHERE event_id = $1', [id]);
    if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (ev.rows[0].created_by !== userId) return res.status(403).json({ error: 'Only the event host can delete media' });
    
    // Verify media exists for this event
    const media = await pool.query('SELECT media_id FROM EventMedia WHERE media_id = $1 AND event_id = $2', [mediaId, id]);
    if (!media.rows.length) return res.status(404).json({ error: 'Media not found' });
    
    // Delete the media record
    await pool.query('DELETE FROM EventMedia WHERE media_id = $1', [mediaId]);
    
    return res.json({ success: true, message: 'Media deleted' });
  } catch (err) { next(err); }
});

export default router;
