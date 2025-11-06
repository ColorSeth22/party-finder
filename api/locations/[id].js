const { db } = require('../../_db');

module.exports = async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  const idx = db.findIndex((d) => String(d.id) === String(id));

  if (method === 'PUT') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const updates = req.body || {};
    db[idx] = { ...db[idx], ...updates };
    return res.status(200).json(db[idx]);
  }

  if (method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const removed = db.splice(idx, 1)[0];
    return res.status(200).json(removed);
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).send('Method Not Allowed');
};
