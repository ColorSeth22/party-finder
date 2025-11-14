import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Attempt to load .env.development.local then .env as fallback
const rootDir = path.resolve(process.cwd());
const candidateFiles = [
  path.join(rootDir, '.env.development.local'),
  path.join(rootDir, '.env.local'),
  path.join(rootDir, '.env')
];

for (const file of candidateFiles) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: false });
  }
}

// Basic diagnostics (only show keys, not secret values)
const requiredKeys = ['DATABASE_URL', 'JWT_SECRET'];
const missing = requiredKeys.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn('[env] Missing required env vars:', missing.join(', '));
} else {
  console.log('[env] Loaded env vars:', requiredKeys.map(k => `${k}=set`).join(' '));
}

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET
};
