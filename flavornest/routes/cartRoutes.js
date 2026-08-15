const express = require('express');
const { protect } = require('../middleware/auth');
const cartController = require('../controllers/cartController');

const router = express.Router();

router.get('/', protect, cartController.getCart);
router.post('/items', protect, cartController.upsertItem);
router.delete('/items/:recipeId', protect, cartController.removeItem);
router.delete('/', protect, cartController.clearCart);

module.exports = router;
