/**
 * Recommendation engine
 * ─────────────────────
 * Two algorithms, both computed on the backend (no external AI API needed):
 *
 * 1. pantryMatch(tokens, recipes)
 *    Given free-text ingredients a user has on hand, scores every recipe by
 *    what fraction of its keyword/ingredient set is covered, rewarding exact
 *    title/cuisine hits with a smaller bonus weight. Returns ranked matches
 *    with a 0-100 "match %" so the UI can show "You can make this - 83% match".
 *
 * 2. similarRecipes(target, all)
 *    Jaccard similarity over combined keyword + dietTag + cuisine sets,
 *    used for the "You might also like" panel on a recipe's detail view.
 */

function tokenizeIngredients(raw) {
  return String(raw)
    .toLowerCase()
    .split(/[,+\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function pantryMatch(rawInput, recipes, { limit = 12 } = {}) {
  const tokens = tokenizeIngredients(rawInput);
  if (tokens.length === 0) return [];

  const scored = recipes.map((r) => {
    const pool = [
      ...(r.keywords || []),
      ...(r.ingredients || []).map((i) => i.name || i.raw || ''),
    ]
      .join(' | ')
      .toLowerCase();

    let hits = 0;
    tokens.forEach((token) => {
      const isHit =
        pool.includes(token) ||
        r.title.toLowerCase().includes(token) ||
        r.cuisine.toLowerCase().includes(token);
      if (isHit) hits += 1;
    });

    const matchPercent = Math.round((hits / tokens.length) * 100);

    return { recipe: r, hits, matchPercent };
  });

  return scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.matchPercent - a.matchPercent || b.hits - a.hits)
    .slice(0, limit);
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((x) => {
    if (setB.has(x)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function recipeFeatureSet(r) {
  return new Set([
    ...(r.keywords || []).map((k) => k.toLowerCase()),
    ...(r.dietTags || []).map((k) => k.toLowerCase()),
    `cuisine:${r.cuisine.toLowerCase()}`,
  ]);
}

function similarRecipes(target, all, { limit = 4 } = {}) {
  const targetSet = recipeFeatureSet(target);
  const scored = all
    .filter((r) => String(r._id) !== String(target._id))
    .map((r) => ({ recipe: r, score: jaccard(targetSet, recipeFeatureSet(r)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

module.exports = { tokenizeIngredients, pantryMatch, similarRecipes, jaccard };
