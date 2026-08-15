const express = require('express');
const { protect } = require('../middleware/auth');
const mealPlanController = require('../controllers/mealPlanController');

const router = express.Router();

router.get('/', protect, mealPlanController.getPlan);
// Declared before /:day so Express doesn't treat "shopping-list" as a day param
router.get('/shopping-list', protect, mealPlanController.getShoppingList);
router.put('/:day', protect, mealPlanController.setDay);

module.exports = router;
