const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: '', trim: true }, // g, ml, tsp, cup, whole...
    raw: { type: String, trim: true }, // original display string, e.g. "700g boneless chicken, cubed"
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    cuisine: { type: String, required: true, trim: true, index: true },
    image: { type: String, default: '' },
    timeMinutes: { type: Number, required: true, min: 1 },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    servings: { type: Number, default: 4, min: 1 },
    description: { type: String, required: true },

    // Price of a shoppable "recipe kit" (pre-portioned ingredients), used by the cart/checkout system
    price: { type: Number, default: 8.99, min: 0 },
    keywords: [{ type: String, trim: true, lowercase: true }],
    dietTags: [{ type: String, trim: true, lowercase: true }], // vegan, vegetarian, gluten-free...
    ingredients: [ingredientSchema],
    steps: [{ type: String, trim: true }],

    // Cached nutrition estimate (computed heuristically, see utils/nutrition.js)
    nutrition: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      estimatedPerServing: { type: Boolean, default: true },
    },

    // Engagement metrics that drive the trending algorithm
    views: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0, index: true },

    // Moderation workflow for user-submitted recipes
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isSeedRecipe: { type: Boolean, default: false },
  },
  { timestamps: true }
);

recipeSchema.index({ title: 'text', description: 'text', keywords: 'text', cuisine: 'text' });

// Virtual: human readable time, e.g. "50 min" or "3 hr 10 min"
recipeSchema.virtual('timeDisplay').get(function timeDisplay() {
  const m = this.timeMinutes;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} hr ${rem} min` : `${h} hr`;
});

recipeSchema.set('toJSON', { virtuals: true });
recipeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Recipe', recipeSchema);
