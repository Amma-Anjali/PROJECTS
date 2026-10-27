const Article = require('../models/Article');
const User = require('../models/User');
const ReadingHistory = require('../models/ReadingHistory');
const { getOrCreateSummary } = require('../services/aiService');
const { estimateReadingTime, timeAgo } = require('../utils/textHelpers');
const { getCategoriesForLanguage } = require('../services/newsService');

const PAGE_SIZE = 12;

// Adds readingTime + isSaved (for the logged-in user) to a list of
// articles, so views don't need to reach into the DB themselves.
function decorateArticles(articles, savedIds) {
  const savedSet = new Set((savedIds || []).map((id) => id.toString()));
  return articles.map((article) => ({
    ...article.toObject(),
    readingTime: estimateReadingTime(article.description),
    timeAgo: timeAgo(article.publishedAt),
    isSaved: savedSet.has(article._id.toString())
  }));
}

async function getSavedIds(req) {
  if (!req.session.user) return [];
  const user = await User.findById(req.session.user.id).select('savedArticles');
  return user ? user.savedArticles : [];
}

function currentLanguage(req) {
  return req.session.language || 'en';
}

async function showHome(req, res) {
  const language = currentLanguage(req);
  const [featured, latest, savedIds] = await Promise.all([
    Article.findOne({ language }).sort({ publishedAt: -1 }),
    Article.find({ language }).sort({ publishedAt: -1 }).limit(PAGE_SIZE + 1),
    getSavedIds(req)
  ]);

  const latestMinusFeatured = latest.filter(
    (a) => !featured || a._id.toString() !== featured._id.toString()
  ).slice(0, PAGE_SIZE);

  res.render('home', {
    pageTitle: 'NewsLens',
    featured: featured ? decorateArticles([featured], savedIds)[0] : null,
    articles: decorateArticles(latestMinusFeatured, savedIds),
    categories: getCategoriesForLanguage(language)
  });
}

async function showCategory(req, res) {
  const { category } = req.params;
  const language = currentLanguage(req);
  const [articles, savedIds] = await Promise.all([
    Article.find({ category, language }).sort({ publishedAt: -1 }).limit(PAGE_SIZE),
    getSavedIds(req)
  ]);

  res.render('category', {
    pageTitle: `${category} - NewsLens`,
    category,
    articles: decorateArticles(articles, savedIds),
    categories: getCategoriesForLanguage(language)
  });
}

async function search(req, res) {
  const q = (req.query.q || '').trim();
  const language = currentLanguage(req);
  let articles = [];

  if (q) {
    articles = await Article.find({
      language,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(PAGE_SIZE);
  }

  const savedIds = await getSavedIds(req);
  res.render('search', {
    pageTitle: `Search - NewsLens`,
    query: q,
    articles: decorateArticles(articles, savedIds),
    categories: getCategoriesForLanguage(language)
  });
}

async function showArticle(req, res) {
  const language = currentLanguage(req);
  const article = await Article.findById(req.params.id);
  if (!article) {
    return res.status(404).render('search', {
      pageTitle: 'Not found - NewsLens',
      query: '',
      articles: [],
      categories: getCategoriesForLanguage(language)
    });
  }

  // Bump click count for trending, and log reading history if logged in.
  article.clickCount += 1;
  await article.save();

  if (req.session.user) {
    await ReadingHistory.create({ userId: req.session.user.id, articleId: article._id });
  }

  const summary = await getOrCreateSummary(article);
  const savedIds = await getSavedIds(req);

  res.render('article', {
    pageTitle: `${article.title} - NewsLens`,
    article: decorateArticles([article], savedIds)[0],
    summary,
    categories: getCategoriesForLanguage(language)
  });
}

async function showForYou(req, res) {
  const language = currentLanguage(req);
  const user = await User.findById(req.session.user.id);
  const interests = user.interests || [];

  const articles = interests.length
    ? await Article.find({ category: { $in: interests }, language }).sort({ publishedAt: -1 }).limit(PAGE_SIZE)
    : [];

  res.render('forYou', {
    pageTitle: 'For You - NewsLens',
    articles: decorateArticles(articles, user.savedArticles),
    hasInterests: interests.length > 0,
    categories: getCategoriesForLanguage(language)
  });
}

// Simple, explainable trending score: recency + engagement signals.
// No ML - just a weighted sum, resorted on each request.
async function showTrending(req, res) {
  const language = currentLanguage(req);
  const recentArticles = await Article.find({
    language,
    publishedAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) } // last 3 days
  });

  const scored = recentArticles.map((article) => {
    const hoursOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 72 - hoursOld); // newer = higher
    const score = recencyScore + article.clickCount * 5 + article.saveCount * 8;
    return { article, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topArticles = scored.slice(0, PAGE_SIZE).map((s) => s.article);
  const savedIds = await getSavedIds(req);

  res.render('trending', {
    pageTitle: 'Trending - NewsLens',
    articles: decorateArticles(topArticles, savedIds),
    categories: getCategoriesForLanguage(language)
  });
}

module.exports = { showHome, showCategory, search, showArticle, showForYou, showTrending };
