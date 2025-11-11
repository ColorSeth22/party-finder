import { pool } from '../../server/db.js';
import { optionalAuth } from '../../server/auth.js';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
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

      const [eventsCreated, upcomingEvents, checkinsMade, favoritesSaved] = await Promise.all([
        pool.query('SELECT COUNT(*)::INT AS count FROM Events WHERE created_by = $1', [id]),
        pool.query('SELECT COUNT(*)::INT AS count FROM Events WHERE created_by = $1 AND start_time >= NOW()', [id]),
        pool.query('SELECT COUNT(*)::INT AS count FROM CheckIns WHERE user_id = $1', [id]),
        pool.query('SELECT COUNT(*)::INT AS count FROM Favorites WHERE user_id = $1', [id])
      ]);

      const activitiesQuery = `
        SELECT 
          ua.activity_id,
          ua.activity_type,
          ua.points_earned,
          ua.created_at,
          ua.metadata,
          ua.event_id,
          e.title AS event_title,
          e.start_time
        FROM UserActivities ua
        LEFT JOIN Events e ON ua.event_id = e.event_id
        WHERE ua.user_id = $1
        ORDER BY ua.created_at DESC
        LIMIT 20
      `;
      const activitiesResult = await pool.query(activitiesQuery, [id]);

      const eventsCreatedCount = eventsCreated.rows[0]?.count || 0;
      const upcomingHostedCount = upcomingEvents.rows[0]?.count || 0;
      const checkinsCount = checkinsMade.rows[0]?.count || 0;
      const favoritesCount = favoritesSaved.rows[0]?.count || 0;

      return sendJson(res, 200, {
        user: {
          user_id: user.user_id,
          email: user.email,
          display_name: user.display_name,
          reputation_score: user.reputation_score,
          created_at: user.created_at
        },
        stats: {
          events_created: eventsCreatedCount,
          upcoming_events_hosting: upcomingHostedCount,
          checkins_made: checkinsCount,
          favorites_saved: favoritesCount,
          total_contributions: eventsCreatedCount + checkinsCount + favoritesCount
        },
        recent_activities: activitiesResult.rows.map((activity) => ({
          activity_id: activity.activity_id,
          type: activity.activity_type,
          points: activity.points_earned,
          created_at: activity.created_at,
          event: activity.event_id ? {
            id: activity.event_id,
            title: activity.event_title,
            start_time: activity.start_time
          } : null,
          metadata: activity.metadata
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
