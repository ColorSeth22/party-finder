// Load environment variables early
import './config/env.js';
import { createApp } from './app.js';

const port = process.env.PORT || 3000;
if (!process.env.DATABASE_URL) {
  console.warn('[startup] DATABASE_URL is undefined at runtime');
}
if (!process.env.JWT_SECRET) {
  console.warn('[startup] JWT_SECRET is undefined at runtime');
}
const app = createApp();

app.listen(port, () => {
  console.log(`[party-finder] Express API listening on port ${port}`);
});
