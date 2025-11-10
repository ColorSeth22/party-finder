const { pool } = require('../db');
const { optionalAuth } = require('../middleware/auth');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  let { id } = (req.query || {});
  
  // If no id provided, use authenticated user's id
  const authResult = await optionalAuth(req);
  if (!id) {
    if (authResult.user) {
      id = authResult.user.user_id;
    } else {
      return sendJson(res, 401, { error: 'User ID required or authentication needed' });
    }
  }

  try {
    if (req.method === 'GET') {
      // Get user profile
      const userQuery = `
        SELECT 
          user_id,
          email,
          display_name,
          reputation_score,
          created_at
        FROM Users
        WHERE user_id = $1
      `;
      const userResult = await pool.query(userQuery, [id]);
      
      if (userResult.rows.length === 0) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Get user statistics
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT l.location_id) as locations_added,
          COALESCE(SUM(CASE WHEN ua.activity_type = 'edit_location' THEN 1 ELSE 0 END), 0) as locations_edited,
          COALESCE(SUM(CASE WHEN ua.activity_type = 'edit_tags' THEN 1 ELSE 0 END), 0) as tags_edited,
          COALESCE(SUM(CASE WHEN ua.activity_type = 'add_rating' THEN 1 ELSE 0 END), 0) as ratings_added
        FROM Users u
        LEFT JOIN Locations l ON u.user_id = l.created_by
        LEFT JOIN UserActivities ua ON u.user_id = ua.user_id
        WHERE u.user_id = $1
        GROUP BY u.user_id
      `;
      const statsResult = await pool.query(statsQuery, [id]);
      const stats = statsResult.rows[0] || {
        locations_added: 0,
        locations_edited: 0,
        tags_edited: 0,
        ratings_added: 0
      };

      // Get recent activities
      const activitiesQuery = `
        SELECT 
          ua.activity_id,
          ua.activity_type,
          ua.points_earned,
          ua.created_at,
          ua.metadata,
          l.name as location_name,
          l.location_id
        FROM UserActivities ua
        LEFT JOIN Locations l ON ua.location_id = l.location_id
        WHERE ua.user_id = $1
        ORDER BY ua.created_at DESC
        LIMIT 20
      `;
      const activitiesResult = await pool.query(activitiesQuery, [id]);

      return sendJson(res, 200, {
        user: {
          user_id: user.user_id,
          email: user.email,
          display_name: user.display_name,
          reputation_score: user.reputation_score,
          created_at: user.created_at
        },
        stats: {
          locations_added: parseInt(stats.locations_added),
          locations_edited: parseInt(stats.locations_edited),
          tags_edited: parseInt(stats.tags_edited),
          ratings_added: parseInt(stats.ratings_added),
          total_contributions: parseInt(stats.locations_added) + 
                              parseInt(stats.locations_edited) + 
                              parseInt(stats.tags_edited) + 
                              parseInt(stats.ratings_added)
        },
        recent_activities: activitiesResult.rows.map(a => ({
          activity_id: a.activity_id,
          type: a.activity_type,
          points: a.points_earned,
          created_at: a.created_at,
          location: a.location_name ? {
            id: a.location_id,
            name: a.location_name
          } : null,
          metadata: a.metadata
        }))
      });
    }

    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    res.end('Method Not Allowed');
  } catch (error) {
    console.error('API Error:', error);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
