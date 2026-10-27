const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/register', authController.showRegister);
router.post('/register', asyncHandler(authController.register));

router.get('/login', authController.showLogin);
router.post('/login', asyncHandler(authController.login));

router.post('/logout', authController.logout);

module.exports = router;
