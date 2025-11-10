import { pool } from '../db';
import { requireAuth } from '../middleware/auth';

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
    // Require authentication
    const authResult = await requireAuth(req);
    if (authResult.error) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }
    const { user } = authResult;

    if (req.method === 'GET') {
      // Get current preference
      const result = await pool.query(
        'SELECT allow_data_collection FROM Users WHERE user_id = $1',
        [user.user_id]
      );
      
      if (!result.rows.length) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      return sendJson(res, 200, {
        allow_data_collection: result.rows[0].allow_data_collection || false
      });
    }

    if (req.method === 'PUT') {
      // Update preference
      const body = await readJsonBody(req);
      
      if (typeof body.allow_data_collection !== 'boolean') {
        return sendJson(res, 400, { error: 'allow_data_collection must be a boolean' });
      }

      const result = await pool.query(
        `UPDATE Users 
         SET allow_data_collection = $1 
         WHERE user_id = $2 
         RETURNING allow_data_collection`,
        [body.allow_data_collection, user.user_id]
      );

      if (!result.rows.length) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      return sendJson(res, 200, {
        success: true,
        allow_data_collection: result.rows[0].allow_data_collection
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
