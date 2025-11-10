const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

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
        } catch (e) {
          resolve({});
        }
      });
      req.on('error', reject);
    } catch (e) {
      resolve({});
    }
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Query locations with their tags
      const query = `
        SELECT 
          l.location_id as id,
          l.name,
          l.latitude as lat,
          l.longitude as lng,
          l.address,
          l.description,
          COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tags
        FROM Locations l
        LEFT JOIN LocationTags lt ON l.location_id = lt.location_id
        LEFT JOIN Tags t ON lt.tag_id = t.tag_id
        GROUP BY l.location_id, l.name, l.latitude, l.longitude, l.address, l.description
        ORDER BY l.created_at DESC
      `;
      const result = await pool.query(query);
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      // Require authentication for creating locations
      const authResult = await requireAuth(req);
      if (authResult.error) {
        return sendJson(res, authResult.status, { error: authResult.error });
      }
      const { user } = authResult;

      const loc = await readJsonBody(req);
      if (!loc || !loc.name || loc.lat === undefined || loc.lng === undefined) {
        return sendJson(res, 400, { error: 'Invalid location payload: name, lat, lng required' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert location with created_by set to authenticated user
        const insertLocation = `
          INSERT INTO Locations (name, latitude, longitude, address, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING location_id as id, name, latitude as lat, longitude as lng, address, description
        `;
        const locResult = await client.query(insertLocation, [
          loc.name,
          loc.lat,
          loc.lng,
          loc.address || null,
          loc.description || null,
          user.user_id
        ]);
        const newLocation = locResult.rows[0];

        // Insert tags if provided
        if (Array.isArray(loc.tags) && loc.tags.length > 0) {
          for (const tagName of loc.tags) {
            // Upsert tag
            const tagResult = await client.query(
              `INSERT INTO Tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING tag_id`,
              [tagName]
            );
            const tagId = tagResult.rows[0].tag_id;

            // Link location to tag
            await client.query(
              `INSERT INTO LocationTags (location_id, tag_id) VALUES ($1, $2)`,
              [newLocation.id, tagId]
            );
          }
          newLocation.tags = loc.tags;
        } else {
          newLocation.tags = [];
        }

        // Award points for adding a location
        await client.query(
          `SELECT award_points($1, 'add_location', $2, $3)`,
          [user.user_id, newLocation.id, JSON.stringify({ location_name: loc.name })]
        );

        await client.query('COMMIT');
        return sendJson(res, 201, newLocation);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    res.setHeader('Allow', 'GET, POST');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
