const { SUPPORTED_LANGUAGES } = require('../services/newsService');

// Sets the visitor's news language for this session and sends them
// back where they came from - EXCEPT from an article page. An article
// is a fixed document in one fixed language (Article.language), so
// switching languages there and reloading the same URL just re-shows
// the exact same article in the exact same language - it looks like
// the switch "didn't work". Sending them home instead is what actually
// lets the newly-picked language's own articles show up.
function setLanguage(req, res) {
  const { lang } = req.body;
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    req.session.language = lang;
  }

  const referer = req.get('Referer') || '/';
  let redirectTo = referer;
  try {
    const path = new URL(referer, `${req.protocol}://${req.get('host')}`).pathname;
    const articleMatch = path.match(/^\/news\/([^/]+)/);
    const isArticlePage = articleMatch && !['category', 'search', 'trending'].includes(articleMatch[1]);
    if (isArticlePage) redirectTo = '/';
  } catch (err) {
    redirectTo = '/';
  }

  res.redirect(redirectTo);
}

module.exports = { setLanguage };
