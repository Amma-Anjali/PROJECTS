require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const connectDB = require('./config/db');
const sessionMiddleware = require('./middleware/session');
const { initSocket } = require('./config/socket');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { scheduleTrendingDecay } = require('./jobs/trendingDecay');

const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const mealPlanRoutes = require('./routes/mealPlanRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const cultureRoutes = require('./routes/cultureRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const httpServer = http.createServer(app);

connectDB();

// ── Security & performance middleware ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for the bundled static frontend / CDN fonts
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(sessionMiddleware);

// Global rate limiter (auth routes have a stricter one layered on top)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ── Static files ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/mealplan', mealPlanRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/culture', cultureRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FlavorNest API is running', time: new Date().toISOString() });
});

// Fallback to the SPA-ish static frontend for any non-API GET
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => {
  console.log(`🍜 FlavorNest server running on http://localhost:${PORT}`);
  initSocket(httpServer);
  scheduleTrendingDecay();
});
