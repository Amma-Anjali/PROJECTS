const express = require('express');
const { body } = require('express-validator');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { handleValidation } = require('../middleware/validate');
const recipeController = require('../controllers/recipeController');

const router = express.Router();

const recipeValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('cuisine').trim().notEmpty().withMessage('Cuisine is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('timeMinutes').isInt({ min: 1 }).withMessage('timeMinutes must be a positive number'),
  body('servings').optional().isInt({ min: 1 }),
  body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']),
];

router.get('/', recipeController.list);
router.get('/mine', protect, recipeController.mine);
router.get('/pantry-match', recipeController.pantryMatchSearch);
router.get('/:id', optionalAuth, recipeController.getOne);

router.post(
  '/',
  protect,
  upload.single('image'),
  recipeValidation,
  handleValidation,
  recipeController.create
);

router.put('/:id', protect, upload.single('image'), recipeController.update);
router.delete('/:id', protect, recipeController.remove);
router.post('/:id/favorite', protect, recipeController.toggleFavorite);

module.exports = router;
