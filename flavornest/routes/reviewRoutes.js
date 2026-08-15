const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const reviewController = require('../controllers/reviewController');

const router = express.Router();

router.get('/:recipeId', reviewController.list);

router.post(
  '/:recipeId',
  protect,
  [body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5')],
  handleValidation,
  reviewController.upsert
);

router.delete('/:id', protect, reviewController.remove);

module.exports = router;
