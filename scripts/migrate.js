// Simple migration runner for PostgreSQL using DATABASE_URL
// Applies api/db/schema.sql (preferred) or api/db/migration.sql
// Usage: node scripts/migrate.js

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env if present (simple parser to avoid extra deps)
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch (_) {
  // best effort; ignore errors
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL is not set. Add it to your .env or Vercel Project Settings.');
    process.exit(1);
  }

  // Prefer schema.sql, fall back to migration.sql
  const candidates = [
    path.join(__dirname, '..', 'api', 'db', 'schema.sql'),
    path.join(__dirname, '..', 'api', 'db', 'migration.sql')
  ];

  let sqlPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      sqlPath = p;
      break;
    }
  }

  if (!sqlPath) {
    console.error('ERROR: Could not find api/db/schema.sql or api/db/migration.sql');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Applying SQL from ${path.relative(process.cwd(), sqlPath)}...`);

  const client = new Client({ connectionString: url, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
