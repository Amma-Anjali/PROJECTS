const express = require('express');
const router = express.Router();
const languageController = require('../controllers/languageController');

router.post('/language', languageController.setLanguage);

module.exports = router;
