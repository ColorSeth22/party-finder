const fs = require('fs');
const path = require('path');

// Load seed data once per function instance
function loadSeed() {
  try {
    const filePath = path.join(__dirname, '..', '..', '..', 'server', 'data', 'locations.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// In-memory DB for this function instance (non-persistent across cold starts)
const db = loadSeed();

module.exports = async function handler(req, res) {
  const { slug } = req.query || {};
  const parts = Array.isArray(slug) ? slug : (slug ? [slug] : []);

  // /api/locations
  if (parts.length === 0) {
    if (req.method === 'GET') {
      return res.status(200).json(db);
    }
    if (req.method === 'POST') {
      const loc = req.body;
      if (!loc || !loc.id || !loc.name) {
        return res.status(400).json({ error: 'Invalid location payload' });
      }
      if (db.find((d) => d.id === loc.id)) {
        return res.status(409).json({ error: 'Location with this id already exists' });
      }
      db.push(loc);
      return res.status(201).json(loc);
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  // /api/locations/:id
  const id = parts[0];
  const idx = db.findIndex((d) => d.id === id);

  if (req.method === 'PUT') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const update = req.body || {};
    db[idx] = { ...db[idx], ...update };
    return res.status(200).json(db[idx]);
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.splice(idx, 1);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).send('Method Not Allowed');
};
