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
        } catch (error) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function extractEventId(req) {
  if (req.query && req.query.id) return req.query.id;
  if (!req.url) return null;
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  } catch {
    return null;
  }
}

const editableFields = new Set([
  'title',
  'description',
  'host_type',
  'location_lat',
  'location_lng',
  'start_time',
  'end_time',
  'tags',
  'theme',
  'music_type',
  'cover_charge',
  'is_byob',
  'is_active',
  'visibility'
]);

export default async function handler(req, res) {
  const eventId = extractEventId(req);

  if (!eventId) {
    return sendJson(res, 400, { error: 'Event ID required' });
  }

  try {
    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT 
            event_id AS id,
            title,
            description,
            host_type,
            location_lat,
            location_lng,
            start_time,
            end_time,
            tags,
            theme,
            music_type,
            cover_charge,
            is_byob,
            is_active,
            created_by,
            created_by AS user_id,
            visibility,
            created_at
          FROM Events
          WHERE event_id = $1`,
        [eventId]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: 'Event not found' });
      }

      return sendJson(res, 200, result.rows[0]);
    }

    if (req.method === 'PUT') {
      const authResult = await requireAuth(req);
      if (authResult.error) {
        return sendJson(res, authResult.status, { error: authResult.error });
      }

      const existing = await pool.query(
        'SELECT event_id, created_by FROM Events WHERE event_id = $1',
        [eventId]
      );

      if (!existing.rows.length) {
        return sendJson(res, 404, { error: 'Event not found' });
      }

      if (existing.rows[0].created_by !== authResult.user.user_id) {
        return sendJson(res, 403, { error: 'Only the event owner can update this event' });
      }

      let updates;
      try {
        updates = await readJsonBody(req);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }

      const fields = Object.keys(updates).filter((key) => editableFields.has(key));
      if (!fields.length) {
        return sendJson(res, 400, { error: 'No supported fields provided for update' });
      }

      const setters = [];
      const values = [];

      for (const key of fields) {
        if (key === 'host_type' && !['fraternity', 'house', 'club'].includes(updates[key])) {
          return sendJson(res, 400, { error: 'host_type must be one of fraternity, house, club' });
        }

        if (key === 'visibility' && !['everyone', 'friends'].includes(updates[key])) {
          return sendJson(res, 400, { error: 'visibility must be one of everyone, friends' });
        }

        if ((key === 'start_time' || key === 'end_time') && updates[key]) {
          const date = new Date(updates[key]);
          if (Number.isNaN(date.valueOf())) {
            return sendJson(res, 400, { error: `Invalid date provided for ${key}` });
          }
          setters.push(`${key} = $${setters.length + 1}`);
          values.push(date.toISOString());
          continue;
        }

        if (key === 'tags') {
          if (!Array.isArray(updates.tags)) {
            return sendJson(res, 400, { error: 'tags must be an array of strings' });
          }
          setters.push('tags = $' + (setters.length + 1));
          values.push(updates.tags.map((tag) => String(tag).trim()).filter(Boolean));
          continue;
        }

        if (key === 'location_lat' || key === 'location_lng') {
          const numeric = Number(updates[key]);
          if (Number.isNaN(numeric)) {
            return sendJson(res, 400, { error: `${key} must be a number` });
          }
          setters.push(`${key} = $${setters.length + 1}`);
          values.push(numeric);
          continue;
        }

        if (key === 'is_byob' || key === 'is_active') {
          setters.push(`${key} = $${setters.length + 1}`);
          values.push(Boolean(updates[key]));
          continue;
        }

        setters.push(`${key} = $${setters.length + 1}`);
        values.push(updates[key]);
      }

      values.push(eventId);

      const updateQuery = `
        UPDATE Events
        SET ${setters.join(', ')}, updated_at = NOW()
        WHERE event_id = $${values.length}
        RETURNING 
          event_id AS id,
          title,
          description,
          host_type,
          location_lat,
          location_lng,
          start_time,
          end_time,
          tags,
          theme,
          music_type,
          cover_charge,
          is_byob,
          is_active,
          created_by,
          created_at
      `;

      const result = await pool.query(updateQuery, values);

      await pool.query(
        `SELECT award_points($1, 'edit_event', $2, $3)`,
        [
          authResult.user.user_id,
          eventId,
          JSON.stringify({ updated_fields: fields })
        ]
      );

      return sendJson(res, 200, result.rows[0]);
    }

    res.setHeader('Allow', 'GET, PUT');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('Events/:id API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
