const { db } = require('../../_db');

module.exports = async function handler(req, res) {
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
};
