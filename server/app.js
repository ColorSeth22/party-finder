import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Routers (new Express native implementations)
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import checkinsRouter from './routes/checkins.js';
import favoritesRouter from './routes/favorites.js';
import usersRouter from './routes/users.js';
import replaysRouter from './routes/replays.js';
import ratingsRouter from './routes/ratings.js';
import badgesRouter from './routes/badges.js';
import friendsRouter from './routes/friends.js';
import friendRequestsRouter from './routes/friendRequests.js';
import eventMediaRouter from './routes/eventMedia.js';

export function createApp() {
  const app = express();

  // Explicit CORS configuration (helps debug preflight issues on Vercel)
  const corsOptions = {
    origin: (origin, cb) => cb(null, true), // reflect origin (allows credentials if later enabled)
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    maxAge: 86400
  };
  app.use(cors(corsOptions));

  // Manual preflight handler (some serverless platforms are sensitive to timing)
  app.options('*', cors(corsOptions));

  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  // Basic request trace (disable if noisy)
  app.use((req, _res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[req]', req.method, req.originalUrl, 'hdr:', Object.keys(req.headers));
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root landing for API-only deployment
  app.get('/', (req, res) => {
    res.json({
      service: 'party-finder-api',
      version: process.env.npm_package_version || 'unknown',
      endpoints: ['/api/auth/login','/api/events','/api/health','/api/diagnostics'],
      timestamp: new Date().toISOString()
    });
  });

  // Diagnostics (DO NOT expose secrets) - helpful in serverless
  app.get('/api/diagnostics', (req, res) => {
    res.json({
      env: {
        databaseUrlSet: !!process.env.DATABASE_URL,
        jwtSecretSet: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV || 'undefined'
      },
      request: {
        method: req.method,
        path: req.originalUrl,
        headersSample: Object.fromEntries(Object.entries(req.headers).slice(0, 10))
      },
      timestamp: new Date().toISOString()
    });
  });

  // Routers
  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/checkins', checkinsRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/replays', replaysRouter);
  app.use('/api/ratings', ratingsRouter);
  app.use('/api/badges', badgesRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/friends/requests', friendRequestsRouter);
  app.use('/api/events', eventMediaRouter); // media sub-routes mounted on /api/events (merges on same path)

  // 404 fallback (after routes)
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  });

  // Central error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  return app;
}
