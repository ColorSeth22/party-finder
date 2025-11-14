import { Pool } from 'pg';

// Reuse a single Pool across serverless invocations (Vercel) using globalThis
function getPool() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    return {
      query: async () => {
        throw new Error(' is not configured. Set it in Vercel project Environment Variables.');
      }
    };
  }

  if (!globalThis.__partyFinderPool) {
    const p = new Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Optional: tune for serverless to reduce idle connections
      max: 5,            // small pool; scale horizontally
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });

    p.on('connect', () => {
      console.log('[db] PostgreSQL pool connected');
    });

    p.on('error', (err) => {
      console.error('[db] Unexpected error on idle client', err);
    });

    globalThis.__partyFinderPool = p;
  }
  return globalThis.__partyFinderPool;
}

export const pool = getPool();
