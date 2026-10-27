const Article = require('../models/Article');
const { getOrCreateArticleReader } = require('../services/aiService');
const { SUPPORTED_LANGUAGES } = require('../services/newsService');

// Called by the AI Reader language tabs on the article page (fetch,
// not a full page load) so switching languages doesn't re-render the
// whole article. Returns cached JSON if we've already generated this
// article+language before; otherwise generates it once and caches it.
async function getReader(req, res) {
  const { articleId, language } = req.params;

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: 'Unsupported language.' });
  }

  const article = await Article.findById(articleId);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  const reader = await getOrCreateArticleReader(article, language);
  if (!reader || reader.error) {
    return res.status(502).json({ error: (reader && reader.error) || 'AI reader is unavailable right now.' });
  }

  res.json({
    summary: reader.summary,
    keyPoints: reader.keyPoints,
    readerContent: reader.readerContent
  });
}

module.exports = { getReader };
