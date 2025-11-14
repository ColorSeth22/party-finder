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

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Central error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  return app;
}
