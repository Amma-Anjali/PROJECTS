require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./config/db');
const { attachUserToLocals, attachLanguageToLocals } = require('./middleware/auth');

const newsRoutes = require('./routes/newsRoutes');
const authRoutes = require('./routes/authRoutes');
const savedRoutes = require('./routes/savedRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const profileRoutes = require('./routes/profileRoutes');
const languageRoutes = require('./routes/languageRoutes');
const readerRoutes = require('./routes/readerRoutes');

const app = express();

// --- Database ---
connectDB();

// --- View engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Core middleware ---
app.use(express.urlencoded({ extended: true })); // parse HTML form submissions
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Sessions (stored in MongoDB so login survives server restarts) ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// Makes res.locals.currentUser available in every view (navbar login state).
app.use(attachUserToLocals);
// Makes res.locals.currentLanguage available in every view (language switcher).
app.use(attachLanguageToLocals);

// --- Routes ---
app.use('/', authRoutes);
app.use('/', savedRoutes);
app.use('/', summaryRoutes);
app.use('/', profileRoutes);
app.use('/', languageRoutes);
app.use('/', readerRoutes);
app.use('/', newsRoutes); // mounted last: it owns "/" and the broad "/news/:id" pattern

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).render('notFound', { pageTitle: 'Not Found - NewsLens', categories: [] });
});

// --- Central error handler: never show a raw stack trace to users ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('serverError', { pageTitle: 'Something went wrong - NewsLens', categories: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NewsLens running on http://localhost:${PORT}`);
});
