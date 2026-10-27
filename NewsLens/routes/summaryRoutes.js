const express = require('express');
const router = express.Router();
const summaryController = require('../controllers/summaryController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/summary/:articleId', asyncHandler(summaryController.getSummary));
router.post('/summary/:articleId', asyncHandler(summaryController.createSummary));

module.exports = router;
