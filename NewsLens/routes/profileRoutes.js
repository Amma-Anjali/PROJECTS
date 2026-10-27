const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/profile', requireAuth, asyncHandler(profileController.showProfile));
router.post('/profile/interests', requireAuth, asyncHandler(profileController.updateInterests));
router.get('/history', requireAuth, asyncHandler(profileController.showHistory));

module.exports = router;
