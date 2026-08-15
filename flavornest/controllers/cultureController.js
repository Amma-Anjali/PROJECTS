const CULTURE_FACTS = require('../data/cultureFacts');
const Recipe = require('../models/Recipe');

// GET /api/culture - list all cultures with basic facts + recipe counts
async function list(req, res, next) {
  try {
    const counts = await Recipe.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$cuisine', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

    const cultures = Object.entries(CULTURE_FACTS).map(([name, facts]) => ({
      name,
      ...facts,
      recipeCount: countMap[name] || 0,
    }));

    res.json({ success: true, count: cultures.length, cultures });
  } catch (err) {
    next(err);
  }
}

// GET /api/culture/:name
async function getOne(req, res, next) {
  try {
    const key = Object.keys(CULTURE_FACTS).find((k) => k.toLowerCase() === req.params.name.toLowerCase());
    if (!key) return res.status(404).json({ success: false, message: 'No culture facts found for that cuisine' });

    const recipeCount = await Recipe.countDocuments({ cuisine: key, status: 'approved' });
    res.json({ success: true, culture: { name: key, ...CULTURE_FACTS[key], recipeCount } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne };
