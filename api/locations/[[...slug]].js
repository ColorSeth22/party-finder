// Deprecated catch-all route. Kept as a safety net but returns 404 so explicit
// routes in `api/locations/index.js` and `api/locations/[id].js` handle traffic.
module.exports = async function handler(req, res) {
  return res.status(404).json({ error: 'Not Found' });
};
