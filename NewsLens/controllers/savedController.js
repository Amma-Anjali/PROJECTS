const User = require('../models/User');
const Article = require('../models/Article');
const { estimateReadingTime, timeAgo } = require('../utils/textHelpers');

async function saveArticle(req, res) {
  const { articleId } = req.params;
  const user = await User.findById(req.session.user.id);

  // Prevent duplicate saves.
  const alreadySaved = user.savedArticles.some((id) => id.toString() === articleId);
  if (!alreadySaved) {
    user.savedArticles.push(articleId);
    await user.save();
    await Article.findByIdAndUpdate(articleId, { $inc: { saveCount: 1 } });
  }

  res.redirect('back');
}

async function removeArticle(req, res) {
  const { articleId } = req.params;
  const user = await User.findById(req.session.user.id);

  user.savedArticles = user.savedArticles.filter((id) => id.toString() !== articleId);
  await user.save();

  res.redirect('back');
}

async function showSaved(req, res) {
  const user = await User.findById(req.session.user.id).populate('savedArticles');

  const articles = user.savedArticles.map((article) => ({
    ...article.toObject(),
    readingTime: estimateReadingTime(article.description),
    timeAgo: timeAgo(article.publishedAt),
    isSaved: true
  }));

  res.render('saved', { pageTitle: 'Saved - NewsLens', articles, categories: [] });
}

module.exports = { saveArticle, removeArticle, showSaved };
