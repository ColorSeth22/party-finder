import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

export default async function handler(req, res) {
  try {
    const authResult = await requireAuth(req);
    if (authResult.error) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }

    if (req.method === 'GET') {
      const query = `
        SELECT 
          e.event_id AS id,
          e.title,
          e.description,
          e.host_type,
          e.location_lat,
          e.location_lng,
          e.start_time,
          e.end_time,
          e.tags,
          e.theme,
          e.music_type,
          e.cover_charge,
          e.is_byob,
          e.is_active,
          e.created_by,
          e.created_at,
          e.updated_at,
          f.created_at AS favorited_at
        FROM Favorites f
        JOIN Events e ON e.event_id = f.event_id
        WHERE f.user_id = $1
        ORDER BY e.start_time ASC
      `;

      const result = await pool.query(query, [authResult.user.user_id]);
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }

      if (!payload.event_id) {
        return sendJson(res, 400, { error: 'event_id is required' });
      }

      const favoriteIntent = payload.favorite !== false; // default to true when omitted

      const eventResult = await pool.query('SELECT event_id FROM Events WHERE event_id = $1', [payload.event_id]);
      if (!eventResult.rows.length) {
        return sendJson(res, 404, { error: 'Event not found' });
      }

      if (!favoriteIntent) {
        await pool.query('DELETE FROM Favorites WHERE user_id = $1 AND event_id = $2', [authResult.user.user_id, payload.event_id]);
        return sendJson(res, 200, { success: true, favorite: false });
      }

      const insertQuery = `
        INSERT INTO Favorites (user_id, event_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, event_id) DO NOTHING
        RETURNING favorite_id, created_at
      `;

      const result = await pool.query(insertQuery, [authResult.user.user_id, payload.event_id]);

      if (result.rows.length) {
        await pool.query(
          `SELECT award_points($1, 'favorite_event', $2, $3)`,
          [
            authResult.user.user_id,
            payload.event_id,
            JSON.stringify({ event_id: payload.event_id })
          ]
        );
      }

      return sendJson(res, 200, {
        success: true,
        favorite: true,
        favorite_id: result.rows.length ? result.rows[0].favorite_id : null
      });
    }

    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('Favorites API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
