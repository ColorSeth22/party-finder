import { pool } from '../../server/db.js';
import { requireAuth } from '../../server/auth.js';

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
        } catch (err) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

function parseFilters(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const hostType = url.searchParams.get('host_type');
    const isActive = url.searchParams.get('is_active');
    const startAfter = url.searchParams.get('start_after');
    const startBefore = url.searchParams.get('start_before');
    return {
      hostType: hostType && ['fraternity', 'house', 'club'].includes(hostType) ? hostType : null,
      isActive: isActive === null ? null : isActive !== 'false',
      startAfter: startAfter ? new Date(startAfter) : null,
      startBefore: startBefore ? new Date(startBefore) : null
    };
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const filters = parseFilters(req);
      const conditions = [];
      const values = [];

      if (filters.hostType) {
        values.push(filters.hostType);
        conditions.push(`host_type = $${values.length}`);
      }
      if (filters.isActive !== null) {
        values.push(filters.isActive);
        conditions.push(`is_active = $${values.length}`);
      }
      if (filters.startAfter && !Number.isNaN(filters.startAfter.valueOf())) {
        values.push(filters.startAfter.toISOString());
        conditions.push(`start_time >= $${values.length}`);
      }
      if (filters.startBefore && !Number.isNaN(filters.startBefore.valueOf())) {
        values.push(filters.startBefore.toISOString());
        conditions.push(`start_time <= $${values.length}`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT 
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
        FROM Events
        ${whereClause}
        ORDER BY start_time ASC
      `;
      const result = await pool.query(query, values);
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
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

      const requiredFields = ['title', 'host_type', 'location_lat', 'location_lng', 'start_time'];
      for (const field of requiredFields) {
        if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
          return sendJson(res, 400, { error: `Missing required field: ${field}` });
        }
      }

      const hostType = String(payload.host_type);
      if (!['fraternity', 'house', 'club'].includes(hostType)) {
        return sendJson(res, 400, { error: 'host_type must be one of fraternity, house, club' });
      }

      const startTime = new Date(payload.start_time);
      if (Number.isNaN(startTime.valueOf())) {
        return sendJson(res, 400, { error: 'Invalid start_time value' });
      }

      let endTime = null;
      if (payload.end_time) {
        const parsed = new Date(payload.end_time);
        if (Number.isNaN(parsed.valueOf())) {
          return sendJson(res, 400, { error: 'Invalid end_time value' });
        }
        endTime = parsed.toISOString();
      }

      const latitude = Number(payload.location_lat);
      const longitude = Number(payload.location_lng);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return sendJson(res, 400, { error: 'location_lat and location_lng must be numbers' });
      }

      const tags = Array.isArray(payload.tags)
        ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [];

      const insertQuery = `
        INSERT INTO Events (
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
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, false), $13, $14)
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

      const values = [
        payload.title,
        payload.description || null,
        hostType,
  latitude,
  longitude,
        startTime.toISOString(),
        endTime,
        tags,
        payload.theme || null,
        payload.music_type || null,
        payload.cover_charge || null,
        typeof payload.is_byob === 'boolean' ? payload.is_byob : null,
        payload.is_active !== false,
        authResult.user.user_id
      ];

      const result = await pool.query(insertQuery, values);

      await pool.query(
        `SELECT award_points($1, 'add_event', $2, $3)`,
        [
          authResult.user.user_id,
          result.rows[0].id,
          JSON.stringify({ event_title: payload.title })
        ]
      );

      return sendJson(res, 201, result.rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('Events API error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
}
