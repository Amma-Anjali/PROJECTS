const User = require('../models/User');

/**
 * Session-based auth (cookie + server-side session store in MongoDB).
 * No tokens to generate, store, or attach to headers - the browser handles
 * the cookie automatically. req.session.userId is set on login/register
 * and cleared on logout.
 */

// Requires an active logged-in session; attaches req.user
async function protect(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authorized, please log in' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ success: false, message: 'Session is invalid, please log in again' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Attaches req.user if a session is active, but never blocks the request
async function optionalAuth(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) req.user = user;
    }
  } catch (err) {
    // ignore - optional auth never fails the request
  }
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

module.exports = { protect, optionalAuth, adminOnly };
