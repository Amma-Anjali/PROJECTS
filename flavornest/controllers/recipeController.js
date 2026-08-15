const Recipe = require('../models/Recipe');
const Review = require('../models/Review');
const User = require('../models/User');
const { pantryMatch, similarRecipes } = require('../utils/recommend');
const { estimateNutrition } = require('../utils/nutrition');
const { computeTrendingScore } = require('../utils/trending');

/**
 * GET /api/recipes
 * Query params: search, cuisine, difficulty, maxTime, diet, sort (trending|rating|newest|quickest), page, limit
 */
async function list(req, res, next) {
  try {
    const { search, cuisine, difficulty, maxTime, diet, sort = 'trending', page = 1, limit = 12 } = req.query;

    const filter = { status: 'approved' };
    if (cuisine) filter.cuisine = new RegExp(`^${cuisine}$`, 'i');
    if (difficulty) filter.difficulty = difficulty;
    if (maxTime) filter.timeMinutes = { $lte: Number(maxTime) };
    if (diet) filter.dietTags = diet.toLowerCase();
    if (search) filter.$text = { $search: search };

    const sortMap = {
      trending: { trendingScore: -1 },
      rating: { avgRating: -1, ratingsCount: -1 },
      newest: { createdAt: -1 },
      quickest: { timeMinutes: 1 },
    };

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const [recipes, total] = await Promise.all([
      Recipe.find(filter)
        .sort(sortMap[sort] || sortMap.trending)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Recipe.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: recipes.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      recipes,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/recipes/mine - every recipe the logged-in user has submitted, any status
async function mine(req, res, next) {
  try {
    const recipes = await Recipe.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err) {
    next(err);
  }
}

// GET /api/recipes/pantry-match?ingredients=chicken,rice,garlic
async function pantryMatchSearch(req, res, next) {
  try {
    const { ingredients } = req.query;
    if (!ingredients) {
      return res.status(400).json({ success: false, message: 'Provide an "ingredients" query param' });
    }
    const all = await Recipe.find({ status: 'approved' });
    const matches = pantryMatch(ingredients, all, { limit: 12 });

    res.json({
      success: true,
      count: matches.length,
      results: matches.map((m) => ({ recipe: m.recipe, matchPercent: m.matchPercent })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/recipes/:id - detail view, increments views, includes reviews + similar recipes
async function getOne(req, res, next) {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    recipe.views += 1;
    recipe.trendingScore = computeTrendingScore(recipe);
    await recipe.save();

    if (req.user) {
      req.user.viewedRecipes.unshift({ recipe: recipe._id, viewedAt: new Date() });
      req.user.viewedRecipes = req.user.viewedRecipes.slice(0, 50);
      await req.user.save();
    }

    const [reviews, allApproved] = await Promise.all([
      Review.find({ recipe: recipe._id }).populate('user', 'name').sort({ createdAt: -1 }),
      Recipe.find({ status: 'approved' }),
    ]);

    const similar = similarRecipes(recipe, allApproved, { limit: 4 }).map((s) => s.recipe);

    res.json({ success: true, recipe, reviews, similar });
  } catch (err) {
    next(err);
  }
}

// POST /api/recipes - submit a recipe (published immediately, no moderation step)
async function create(req, res, next) {
  try {
    let { title, cuisine, description, timeMinutes, servings, difficulty, keywords, dietTags, ingredients, steps } =
      req.body;

    // Fields may arrive as JSON strings when sent via multipart/form-data
    keywords = typeof keywords === 'string' ? JSON.parse(keywords) : keywords || [];
    dietTags = typeof dietTags === 'string' ? JSON.parse(dietTags) : dietTags || [];
    ingredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients || [];
    steps = typeof steps === 'string' ? JSON.parse(steps) : steps || [];

    const nutrition = estimateNutrition(ingredients, Number(servings) || 4);

    const recipe = await Recipe.create({
      title,
      cuisine,
      description,
      timeMinutes: Number(timeMinutes),
      servings: Number(servings) || 4,
      difficulty: difficulty || 'Easy',
      keywords,
      dietTags,
      ingredients,
      steps,
      nutrition,
      image: req.file ? `/uploads/${req.file.filename}` : req.body.image || '',
      createdBy: req.user._id,
      status: 'approved',
    });

    res.status(201).json({
      success: true,
      message: 'Recipe published',
      recipe,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/recipes/:id - owner or admin only
async function update(req, res, next) {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const isOwner = recipe.createdBy && String(recipe.createdBy) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this recipe' });
    }

    const updatable = ['title', 'cuisine', 'description', 'timeMinutes', 'servings', 'difficulty'];
    updatable.forEach((field) => {
      if (req.body[field] !== undefined) recipe[field] = req.body[field];
    });

    ['keywords', 'dietTags', 'ingredients', 'steps'].forEach((field) => {
      if (req.body[field] !== undefined) {
        recipe[field] = typeof req.body[field] === 'string' ? JSON.parse(req.body[field]) : req.body[field];
      }
    });

    if (req.file) recipe.image = `/uploads/${req.file.filename}`;

    if (req.body.ingredients || req.body.servings) {
      recipe.nutrition = estimateNutrition(recipe.ingredients, recipe.servings);
    }

    await recipe.save();
    res.json({ success: true, recipe });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/recipes/:id - owner or admin only
async function remove(req, res, next) {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const isOwner = recipe.createdBy && String(recipe.createdBy) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this recipe' });
    }

    await recipe.deleteOne();
    await Review.deleteMany({ recipe: recipe._id });
    res.json({ success: true, message: 'Recipe deleted' });
  } catch (err) {
    next(err);
  }
}

// POST /api/recipes/:id/favorite - toggle favorite for the logged-in user
async function toggleFavorite(req, res, next) {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const user = await User.findById(req.user._id);
    const idx = user.favorites.findIndex((f) => String(f) === String(recipe._id));

    let favorited;
    if (idx === -1) {
      user.favorites.push(recipe._id);
      recipe.favoritesCount += 1;
      favorited = true;
    } else {
      user.favorites.splice(idx, 1);
      recipe.favoritesCount = Math.max(0, recipe.favoritesCount - 1);
      favorited = false;
    }

    recipe.trendingScore = computeTrendingScore(recipe);
    await Promise.all([user.save(), recipe.save()]);

    res.json({ success: true, favorited, favoritesCount: recipe.favoritesCount, favorites: user.favorites });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  mine,
  pantryMatchSearch,
  getOne,
  create,
  update,
  remove,
  toggleFavorite,
};
