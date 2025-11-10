import { pool } from '../db.js';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  let { id } = (req.query || {});
  
  // Extract id from URL if not provided
  if (!id && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      const parts = u.pathname.split('/').filter(Boolean);
      id = parts[parts.length - 1];
    } catch {}
  }

  try {
    if (req.method === 'GET') {
      if (!id) {
        return sendJson(res, 400, { error: 'Location ID required' });
      }

      // Get current occupancy (last 30 minutes)
      const currentQuery = `
        SELECT 
          AVG(occupancy_level) as current_occupancy,
          COUNT(*) as recent_reports,
          MAX(reported_at) as last_report_time
        FROM OccupancyReports
        WHERE location_id = $1
          AND reported_at > NOW() - INTERVAL '30 minutes'
      `;
      const currentResult = await pool.query(currentQuery, [id]);
      const current = currentResult.rows[0];

      // Get historical pattern for current day and hour
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0-6
      const hourOfDay = now.getHours(); // 0-23

      const patternQuery = `
        SELECT 
          AVG(occupancy_level) as typical_occupancy,
          COUNT(*) as historical_reports
        FROM OccupancyReports
        WHERE location_id = $1
          AND EXTRACT(DOW FROM reported_at) = $2
          AND EXTRACT(HOUR FROM reported_at) = $3
          AND reported_at > NOW() - INTERVAL '30 days'
      `;
      const patternResult = await pool.query(patternQuery, [id, dayOfWeek, hourOfDay]);
      const pattern = patternResult.rows[0];

      // Get full weekly pattern
      const weeklyPatternQuery = `
        SELECT 
          EXTRACT(DOW FROM reported_at)::INTEGER as day_of_week,
          EXTRACT(HOUR FROM reported_at)::INTEGER as hour_of_day,
          AVG(occupancy_level) as avg_occupancy,
          COUNT(*) as report_count
        FROM OccupancyReports
        WHERE location_id = $1
          AND reported_at > NOW() - INTERVAL '30 days'
        GROUP BY day_of_week, hour_of_day
        ORDER BY day_of_week, hour_of_day
      `;
      const weeklyResult = await pool.query(weeklyPatternQuery, [id]);

      return sendJson(res, 200, {
        location_id: id,
        current: {
          occupancy: current.current_occupancy ? parseFloat(current.current_occupancy).toFixed(1) : null,
          level: current.current_occupancy ? Math.round(parseFloat(current.current_occupancy)) : null,
          report_count: parseInt(current.recent_reports),
          last_updated: current.last_report_time,
          status: !current.current_occupancy ? 'no_data' : 
                  current.current_occupancy <= 2 ? 'quiet' :
                  current.current_occupancy <= 3.5 ? 'moderate' : 'busy'
        },
        typical: {
          occupancy: pattern.typical_occupancy ? parseFloat(pattern.typical_occupancy).toFixed(1) : null,
          level: pattern.typical_occupancy ? Math.round(parseFloat(pattern.typical_occupancy)) : null,
          report_count: parseInt(pattern.historical_reports),
          day_of_week: dayOfWeek,
          hour_of_day: hourOfDay
        },
        weekly_pattern: weeklyResult.rows.map(row => ({
          day: parseInt(row.day_of_week),
          hour: parseInt(row.hour_of_day),
          occupancy: parseFloat(row.avg_occupancy).toFixed(1),
          reports: parseInt(row.report_count)
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
