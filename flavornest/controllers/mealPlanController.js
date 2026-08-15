const MealPlan = require('../models/MealPlan');
const Recipe = require('../models/Recipe');

const DAYS = MealPlan.DAYS;

async function getOrCreatePlan(userId) {
  let plan = await MealPlan.findOne({ user: userId });
  if (!plan) plan = await MealPlan.create({ user: userId, entries: {} });
  return plan;
}

// GET /api/mealplan - current user's weekly plan, populated with recipe summaries
async function getPlan(req, res, next) {
  try {
    const plan = await getOrCreatePlan(req.user._id);
    await plan.populate('entries.$*.recipe', 'title image cuisine timeMinutes');
    res.json({ success: true, days: DAYS, entries: plan.entries });
  } catch (err) {
    next(err);
  }
}

// GET /api/mealplan/shopping-list - aggregate ingredients across every planned recipe
async function getShoppingList(req, res, next) {
  try {
    const plan = await getOrCreatePlan(req.user._id);
    const recipeIds = [...plan.entries.values()].map((e) => e.recipe).filter(Boolean);

    if (recipeIds.length === 0) {
      return res.json({ success: true, items: [], message: 'Add recipes to your meal plan to generate a list' });
    }

    const recipes = await Recipe.find({ _id: { $in: recipeIds } });

    // Aggregate by normalized ingredient name + unit, summing quantities
    const aggregated = new Map();
    recipes.forEach((r) => {
      r.ingredients.forEach((ing) => {
        const name = (ing.name || ing.raw || 'ingredient').trim().toLowerCase();
        const unit = ing.unit || '';
        const key = `${name}|${unit}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { name: ing.name || ing.raw, unit, quantity: 0, recipes: new Set() });
        }
        const entry = aggregated.get(key);
        entry.quantity += ing.quantity || 0;
        entry.recipes.add(r.title);
      });
    });

    const items = [...aggregated.values()]
      .map((e) => ({
        name: e.name,
        unit: e.unit,
        quantity: Math.round(e.quantity * 100) / 100,
        usedIn: [...e.recipes],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    plan.shoppingListGeneratedAt = new Date();
    await plan.save();

    res.json({ success: true, count: items.length, generatedAt: plan.shoppingListGeneratedAt, items });
  } catch (err) {
    next(err);
  }
}

// PUT /api/mealplan/:day - assign (or clear with recipeId=null) a recipe to a day
async function setDay(req, res, next) {
  try {
    const day = req.params.day.toLowerCase();
    if (!DAYS.includes(day)) {
      return res.status(400).json({ success: false, message: `day must be one of: ${DAYS.join(', ')}` });
    }

    const { recipeId } = req.body;
    const plan = await getOrCreatePlan(req.user._id);

    if (recipeId) {
      const recipe = await Recipe.findById(recipeId);
      if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
      plan.entries.set(day, { recipe: recipe._id });
    } else {
      plan.entries.delete(day);
    }

    await plan.save();
    await plan.populate('entries.$*.recipe', 'title image cuisine timeMinutes');
    res.json({ success: true, days: DAYS, entries: plan.entries });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPlan, getShoppingList, setDay };
