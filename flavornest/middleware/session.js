const session = require('express-session');
const MongoStore = require('connect-mongo');

/**
 * Session config, shared between the main Express app and Socket.io so
 * both recognize the same login. Sessions are stored in MongoDB (via the
 * same connection string as everything else) so logins survive server
 * restarts - no extra service to run.
 *
 * SESSION_SECRET has a built-in fallback so the app works with zero .env
 * editing. Set a real one in .env before deploying anywhere public.
 */
const sessionMiddleware = session({
  name: 'flavornest.sid',
  secret: process.env.SESSION_SECRET || 'flavornest-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flavornest',
    collectionName: 'sessions',
  }),
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: false, // set true if serving over HTTPS in production
  },
});

module.exports = sessionMiddleware;
