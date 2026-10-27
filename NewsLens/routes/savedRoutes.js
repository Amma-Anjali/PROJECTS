const express = require('express');
const router = express.Router();
const savedController = require('../controllers/savedController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/saved', requireAuth, asyncHandler(savedController.showSaved));
router.post('/saved/:articleId', requireAuth, asyncHandler(savedController.saveArticle));
router.post('/saved/:articleId/remove', requireAuth, asyncHandler(savedController.removeArticle));

module.exports = router;
