const Review = require('../models/Review');
const Recipe = require('../models/Recipe');
const { computeTrendingScore } = require('../utils/trending');

async function recalcRecipeRating(recipeId) {
  const stats = await Review.aggregate([
    { $match: { recipe: recipeId } },
    { $group: { _id: '$recipe', avgRating: { $avg: '$rating' }, ratingsCount: { $sum: 1 } } },
  ]);

  const recipe = await Recipe.findById(recipeId);
  if (!recipe) return;

  recipe.avgRating = stats.length ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  recipe.ratingsCount = stats.length ? stats[0].ratingsCount : 0;
  recipe.trendingScore = computeTrendingScore(recipe);
  await recipe.save();
}

// GET /api/reviews/:recipeId
async function list(req, res, next) {
  try {
    const reviews = await Review.find({ recipe: req.params.recipeId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    next(err);
  }
}

// POST /api/reviews/:recipeId - create or update the current user's review (one per user per recipe)
async function upsert(req, res, next) {
  try {
    const { rating, comment } = req.body;
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const review = await Review.findOneAndUpdate(
      { recipe: req.params.recipeId, user: req.user._id },
      { rating, comment: comment || '' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recalcRecipeRating(req.params.recipeId);

    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/reviews/:id - owner or admin only
async function remove(req, res, next) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
    }

    const recipeId = review.recipe;
    await review.deleteOne();
    await recalcRecipeRating(recipeId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, upsert, remove };
