const mongoose = require('mongoose');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const mealPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    entries: {
      type: Map,
      of: new mongoose.Schema(
        { recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' } },
        { _id: false }
      ),
      default: {},
    },
    // Cached, regenerated on demand via GET /api/mealplan/shopping-list
    shoppingListGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

mealPlanSchema.statics.DAYS = DAYS;

module.exports = mongoose.model('MealPlan', mealPlanSchema);
