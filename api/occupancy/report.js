import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

// Haversine formula to calculate distance between two points in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      // Require authentication
      const authResult = await requireAuth(req);
      if (authResult.error) {
        return sendJson(res, authResult.status, { error: authResult.error });
      }
      const { user } = authResult;

      // Check if user has opted in to data collection
      const userCheck = await pool.query(
        'SELECT allow_data_collection FROM Users WHERE user_id = $1',
        [user.user_id]
      );

      if (!userCheck.rows.length || !userCheck.rows[0].allow_data_collection) {
        return sendJson(res, 403, { 
          error: 'Data collection not enabled. Please opt-in from your profile settings to report occupancy.' 
        });
      }

      const report = await readJsonBody(req);
      
      if (!report.location_id || !report.occupancy_level) {
        return sendJson(res, 400, { 
          error: 'Missing required fields: location_id and occupancy_level required' 
        });
      }

      if (report.occupancy_level < 1 || report.occupancy_level > 5) {
        return sendJson(res, 400, { 
          error: 'Invalid occupancy_level. Must be between 1 (empty) and 5 (very crowded)' 
        });
      }

      // REQUIRE GPS coordinates for location verification
      if (!report.latitude || !report.longitude) {
        return sendJson(res, 400, { 
          error: 'GPS location required to verify you are at the location' 
        });
      }

      // Get the location coordinates
      const locationQuery = await pool.query(
        'SELECT latitude, longitude, name FROM Locations WHERE location_id = $1',
        [report.location_id]
      );

      if (!locationQuery.rows.length) {
        return sendJson(res, 404, { 
          error: 'Location not found' 
        });
      }

      const location = locationQuery.rows[0];
      
      // Verify user is within 500 meters of the location
      const MAX_DISTANCE_KM = 0.5;
      const distance = getDistanceKm(
        report.latitude,
        report.longitude,
        location.latitude,
        location.longitude
      );

      if (distance > MAX_DISTANCE_KM) {
        return sendJson(res, 403, {
          error: `You must be within ${Math.round(MAX_DISTANCE_KM * 1000)}m of ${location.name} to report occupancy. You are currently ${Math.round(distance * 1000)}m away.`,
          distance_meters: Math.round(distance * 1000),
          max_distance_meters: Math.round(MAX_DISTANCE_KM * 1000)
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert occupancy report
        const insertQuery = `
          INSERT INTO OccupancyReports 
            (user_id, location_id, occupancy_level, report_latitude, report_longitude, device_type, session_duration)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING report_id, reported_at
        `;
        const result = await client.query(insertQuery, [
          user.user_id,
          report.location_id,
          report.occupancy_level,
          report.latitude || null,
          report.longitude || null,
          report.device_type || 'web',
          report.session_duration || null
        ]);

        // Award points for reporting
        await client.query(
          `SELECT award_points($1, 'report_occupancy', $2, $3)`,
          [user.user_id, report.location_id, JSON.stringify({ occupancy_level: report.occupancy_level })]
        );

        await client.query('COMMIT');

        return sendJson(res, 201, {
          success: true,
          report_id: result.rows[0].report_id,
          reported_at: result.rows[0].reported_at,
          points_earned: 1
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
