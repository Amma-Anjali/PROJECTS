const express = require('express');
const { protect } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/', protect, notificationController.list);
router.put('/:id/read', protect, notificationController.markRead);
router.put('/read-all', protect, notificationController.markAllRead);

module.exports = router;
