const { validationResult } = require('express-validator');

/**
 * Runs after any express-validator check(...) chains on a route.
 * If validation failed, responds with the first error message and stops
 * the request from ever reaching the controller.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
}

module.exports = { handleValidation };
