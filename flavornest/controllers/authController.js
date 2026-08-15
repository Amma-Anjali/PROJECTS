const crypto = require('crypto');
const User = require('../models/User');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    // First user matching ADMIN_EMAIL becomes an admin - convenient for demo/deploy
    const role =
      process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';

    const user = await User.create({ name, email, password, role });

    // Session cookie - no token to hand back, the browser stores this automatically
    req.session.userId = user._id;

    sendWelcomeEmail(user).catch((err) => console.error('Welcome email failed:', err.message));

    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    req.session.userId = user._id;
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
function logout(req, res) {
  if (!req.session) return res.json({ success: true });
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Could not log out, please try again' });
    res.clearCookie('flavornest.sid');
    res.json({ success: true });
  });
}

// POST /api/auth/forgot-password - always responds success (doesn't reveal whether the email exists)
async function forgotPassword(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });

    if (user) {
      const rawToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.APP_URL || 'http://localhost:8080'}/reset-password.html?token=${rawToken}`;
      sendPasswordResetEmail(user, resetUrl).catch((err) => console.error('Reset email failed:', err.message));
    }

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password/:token
async function resetPassword(req, res, next) {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    req.session.userId = user._id;
    res.json({ success: true, message: 'Password updated', user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ success: true, user: req.user.toSafeObject() });
}

// PUT /api/auth/preferences - update dietary preferences & favorite cuisines
async function updatePreferences(req, res, next) {
  try {
    const { dietaryPreferences, favoriteCuisines } = req.body;
    if (dietaryPreferences) req.user.dietaryPreferences = dietaryPreferences;
    if (favoriteCuisines) req.user.favoriteCuisines = favoriteCuisines;
    await req.user.save();
    res.json({ success: true, user: req.user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, forgotPassword, resetPassword, me, updatePreferences };
