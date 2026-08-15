const cron = require('node-cron');
const Recipe = require('../models/Recipe');
const { computeTrendingScore } = require('../utils/trending');

/**
 * Recomputes trendingScore for every approved recipe. Scores already update
 * live on view/favorite/review events, but engagement-less recipes still
 * need their score to decay over time as they age - this nightly sweep
 * handles that without needing a request to trigger it.
 */
async function recalcAllTrendingScores() {
  const recipes = await Recipe.find({ status: 'approved' });
  await Promise.all(
    recipes.map((r) => {
      r.trendingScore = computeTrendingScore(r);
      return r.save();
    })
  );
  console.log(`🔄 Trending scores recalculated for ${recipes.length} recipes`);
}

function scheduleTrendingDecay() {
  // Runs once a day at 03:00 server time
  cron.schedule('0 3 * * *', () => {
    recalcAllTrendingScores().catch((err) => console.error('Trending decay job failed:', err));
  });
}

module.exports = { scheduleTrendingDecay, recalcAllTrendingScores };
