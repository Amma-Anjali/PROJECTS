const Article = require('../models/Article');
const Summary = require('../models/Summary');
const { getOrCreateSummary } = require('../services/aiService');

// GET /summary/:articleId - returns the cached summary if one exists.
async function getSummary(req, res) {
  const summary = await Summary.findOne({ articleId: req.params.articleId });
  if (!summary) {
    return res.status(404).json({ error: 'No summary cached yet.' });
  }
  res.json(summary);
}

// POST /summary/:articleId - generates (or returns cached) summary.
// Used by the article page's "Regenerate" button via fetch/AJAX.
async function createSummary(req, res) {
  const article = await Article.findById(req.params.articleId);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  const summary = await getOrCreateSummary(article);
  if (!summary) {
    return res.status(502).json({ error: 'AI summary service is unavailable right now.' });
  }
  res.json(summary);
}

module.exports = { getSummary, createSummary };
