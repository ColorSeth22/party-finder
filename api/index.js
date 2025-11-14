// Serverless adapter for Express app on Vercel
// This wraps the Express server from server/app.js so it runs as a Vercel function

import '../server/config/env.js'; // Load environment variables
import { createApp } from '../server/app.js';

const app = createApp();

// Export the Express app - Vercel's @vercel/node will handle it automatically
export default app;
