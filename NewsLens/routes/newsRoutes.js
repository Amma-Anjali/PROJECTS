const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(newsController.showHome));
router.get('/news/search', asyncHandler(newsController.search));
router.get('/news/trending', asyncHandler(newsController.showTrending));
router.get('/for-you', requireAuth, asyncHandler(newsController.showForYou));
router.get('/news/category/:category', asyncHandler(newsController.showCategory));
router.get('/news/:id', asyncHandler(newsController.showArticle));

module.exports = router;
