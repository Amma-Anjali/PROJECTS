const User = require('../models/User');
const ReadingHistory = require('../models/ReadingHistory');
const { ALL_CATEGORIES } = require('../services/newsService');
const { estimateReadingTime, timeAgo } = require('../utils/textHelpers');

async function showProfile(req, res) {
  const user = await User.findById(req.session.user.id);
  res.render('profile', {
    pageTitle: 'Profile - NewsLens',
    user,
    allCategories: ALL_CATEGORIES,
    categories: []
  });
}

async function updateInterests(req, res) {
  // Checkbox group: req.body.interests is a string, array, or undefined
  // depending on how many boxes were checked.
  let interests = req.body.interests || [];
  if (typeof interests === 'string') interests = [interests];

  await User.findByIdAndUpdate(req.session.user.id, { interests });
  res.redirect('/profile');
}

async function showHistory(req, res) {
  const HISTORY_LIMIT = 20;
  const history = await ReadingHistory.find({ userId: req.session.user.id })
    .sort({ viewedAt: -1 })
    .limit(HISTORY_LIMIT)
    .populate('articleId');

  const articles = history
    .filter((entry) => entry.articleId) // article may have been removed
    .map((entry) => ({
      ...entry.articleId.toObject(),
      readingTime: estimateReadingTime(entry.articleId.description),
      timeAgo: timeAgo(entry.articleId.publishedAt),
      viewedAt: entry.viewedAt
    }));

  res.render('history', { pageTitle: 'History - NewsLens', articles, categories: [] });
}

module.exports = { showProfile, updateInterests, showHistory };
