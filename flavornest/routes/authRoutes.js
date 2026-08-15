const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = express.Router();

// Stricter limiter on auth endpoints to slow down brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  authController.register
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  handleValidation,
  authController.login
);

router.post('/logout', authController.logout);

router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail()],
  handleValidation,
  authController.forgotPassword
);

router.post(
  '/reset-password/:token',
  authLimiter,
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  handleValidation,
  authController.resetPassword
);

router.get('/me', protect, authController.me);
router.put('/preferences', protect, authController.updatePreferences);

module.exports = router;
