import { Pool } from 'pg';

function createPool() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    // Return a tiny facade that throws a useful error when used
    return {
      query: async () => {
        throw new Error('DATABASE_URL is not configured. Add it to your .env or Vercel project settings.');
      }
    };
  }

  const p = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  p.on('connect', () => {
    console.log('Connected to PostgreSQL database');
  });

  p.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  return p;
}

export const pool = createPool();
