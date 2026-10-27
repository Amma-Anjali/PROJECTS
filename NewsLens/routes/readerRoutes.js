const express = require('express');
const router = express.Router();
const readerController = require('../controllers/readerController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/reader/:articleId/:language', asyncHandler(readerController.getReader));

module.exports = router;
