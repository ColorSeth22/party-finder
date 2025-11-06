const fs = require('fs');
const path = require('path');

function loadSeed() {
  try {
    // From /api to repo root then server/data/locations.json
    const filePath = path.join(__dirname, '..', 'server', 'data', 'locations.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// In-memory DB per function instance
const db = loadSeed();

module.exports = { db };
