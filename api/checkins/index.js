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
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.statusCode = 405;
      return res.end('Method Not Allowed');
    }

    const authResult = await requireAuth(req);
    if (authResult.error) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }

    if (!payload.event_id) {
      return sendJson(res, 400, { error: 'event_id is required' });
    }

    const eventResult = await pool.query('SELECT event_id FROM Events WHERE event_id = $1 AND is_active = true', [payload.event_id]);
    if (!eventResult.rows.length) {
      return sendJson(res, 404, { error: 'Event not found or inactive' });
    }

    const insertQuery = `
      INSERT INTO CheckIns (user_id, event_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, event_id) DO UPDATE SET checked_in_at = NOW()
      RETURNING checkin_id, user_id, event_id, checked_in_at
    `;

    const result = await pool.query(insertQuery, [authResult.user.user_id, payload.event_id]);

    await pool.query(
      `SELECT award_points($1, 'check_in', $2, $3)`,
      [
        authResult.user.user_id,
        payload.event_id,
        JSON.stringify({ event_id: payload.event_id })
      ]
    );

    return sendJson(res, 200, {
      success: true,
      checkin: result.rows[0]
    });
  } catch (error) {
    console.error('Check-ins API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
