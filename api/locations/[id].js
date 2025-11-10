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
  let { id } = (req.query || {});
  // Fallback: extract id from URL if not provided (framework differences)
  if (!id && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      const parts = u.pathname.split('/').filter(Boolean);
      id = parts[parts.length - 1];
    } catch {}
  }
  const method = req.method;

  try {
    if (method === 'PUT') {
      // Require authentication for updating locations
      const authResult = await requireAuth(req);
      if (authResult.error) {
        return sendJson(res, authResult.status, { error: authResult.error });
      }
      const { user } = authResult;

      const updates = await readJsonBody(req);
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Update location basic fields
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        if (updates.name !== undefined) {
          updateFields.push(`name = $${paramCount++}`);
          values.push(updates.name);
        }
        if (updates.lat !== undefined) {
          updateFields.push(`latitude = $${paramCount++}`);
          values.push(updates.lat);
        }
        if (updates.lng !== undefined) {
          updateFields.push(`longitude = $${paramCount++}`);
          values.push(updates.lng);
        }
        if (updates.address !== undefined) {
          updateFields.push(`address = $${paramCount++}`);
          values.push(updates.address);
        }
        if (updates.description !== undefined) {
          updateFields.push(`description = $${paramCount++}`);
          values.push(updates.description);
        }

        if (updateFields.length > 0) {
          values.push(id);
          const updateQuery = `
            UPDATE Locations 
            SET ${updateFields.join(', ')}
            WHERE location_id = $${paramCount}
            RETURNING location_id as id, name, latitude as lat, longitude as lng, address, description
          `;
          const result = await client.query(updateQuery, values);
          
          if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return sendJson(res, 404, { error: 'Not found' });
          }
        }

        // Update tags if provided
        if (Array.isArray(updates.tags)) {
          // Get old tags for activity metadata
          const oldTagsResult = await client.query(
            `SELECT t.name FROM Tags t 
             JOIN LocationTags lt ON t.tag_id = lt.tag_id 
             WHERE lt.location_id = $1`,
            [id]
          );
          const oldTags = oldTagsResult.rows.map(r => r.name);

          // Remove existing tags
          await client.query('DELETE FROM LocationTags WHERE location_id = $1', [id]);

          // Add new tags
          for (const tagName of updates.tags) {
            const tagResult = await client.query(
              `INSERT INTO Tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING tag_id`,
              [tagName]
            );
            const tagId = tagResult.rows[0].tag_id;
            await client.query(
              `INSERT INTO LocationTags (location_id, tag_id) VALUES ($1, $2)`,
              [id, tagId]
            );
          }

          // Award points for editing tags (only if tags changed)
          if (JSON.stringify(oldTags.sort()) !== JSON.stringify(updates.tags.sort())) {
            await client.query(
              `SELECT award_points($1, 'edit_tags', $2, $3)`,
              [user.user_id, id, JSON.stringify({ old_tags: oldTags, new_tags: updates.tags })]
            );
          }
        }

        // Award points for editing location details (if any fields were updated)
        if (updateFields.length > 0) {
          await client.query(
            `SELECT award_points($1, 'edit_location', $2, $3)`,
            [user.user_id, id, JSON.stringify({ fields_updated: Object.keys(updates).filter(k => k !== 'tags') })]
          );
        }

        // Fetch updated location with tags
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
          WHERE l.location_id = $1
          GROUP BY l.location_id, l.name, l.latitude, l.longitude, l.address, l.description
        `;
        const finalResult = await client.query(query, [id]);

        await client.query('COMMIT');
        return sendJson(res, 200, finalResult.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (method === 'DELETE') {
      // Require authentication for deleting locations
      const authResult = await requireAuth(req);
      if (authResult.error) {
        return sendJson(res, authResult.status, { error: authResult.error });
      }

      // CASCADE will automatically delete from LocationTags
      const result = await pool.query(
        'DELETE FROM Locations WHERE location_id = $1 RETURNING location_id as id, name',
        [id]
      );
      
      if (result.rows.length === 0) {
        return sendJson(res, 404, { error: 'Not found' });
      }

      return sendJson(res, 200, { success: true, deleted: result.rows[0] });
    }

    res.setHeader('Allow', 'PUT, DELETE');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
