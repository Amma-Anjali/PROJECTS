const { LANGUAGE_OPTIONS } = require('../services/newsService');

// Attach the logged-in state to every view (used by the navbar to
// show Login vs Profile) without every controller having to do it.
function attachUserToLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

// Attach the visitor's chosen news language (English/Hindi/Telugu/...)
// and the full list of selectable languages to every view. Guests get
// this too - it's a session preference, not tied to an account - so
// switching languages doesn't require login.
function attachLanguageToLocals(req, res, next) {
  res.locals.currentLanguage = req.session.language || 'en';
  res.locals.languageOptions = LANGUAGE_OPTIONS;
  next();
}

// Blocks a route unless the user is logged in.
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

module.exports = { attachUserToLocals, attachLanguageToLocals, requireAuth };
