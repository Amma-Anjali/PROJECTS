const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.get('/trending', analyticsController.trending);
router.get('/overview', protect, adminOnly, analyticsController.overview);

module.exports = router;
