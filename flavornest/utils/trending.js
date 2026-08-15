/**
 * Trending algorithm
 * ──────────────────
 * score = (views * VIEW_WEIGHT + favoritesCount * FAV_WEIGHT + avgRating * RATING_WEIGHT * ratingsCount)
 *         * recencyDecay(ageInDays)
 *
 * Recency decay uses a half-life curve so older recipes need sustained
 * engagement to keep outranking fresh ones - similar in spirit to
 * Reddit/Hacker News style "hot" ranking, but tuned for weekly content cycles.
 */

const VIEW_WEIGHT = 0.5;
const FAV_WEIGHT = 3;
const RATING_WEIGHT = 2;
const HALF_LIFE_DAYS = 10;

function recencyDecay(createdAt) {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function computeTrendingScore(recipe) {
  const engagement =
    recipe.views * VIEW_WEIGHT +
    recipe.favoritesCount * FAV_WEIGHT +
    recipe.avgRating * RATING_WEIGHT * Math.min(recipe.ratingsCount, 20);

  const decay = recencyDecay(recipe.createdAt || Date.now());
  return Math.round(engagement * decay * 100) / 100;
}

module.exports = { computeTrendingScore };
