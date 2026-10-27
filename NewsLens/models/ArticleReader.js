const mongoose = require('mongoose');
const { SUPPORTED_LANGUAGES } = require('../utils/languages');

// Caches the AI Reader output (summary + key points + a reader-friendly
// retelling) for one (article, language) pair, so switching to a
// language you've already generated - or another visitor requesting
// the same article/language - reuses the cached result instead of
// calling the LLM again.
const articleReaderSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  // Was hardcoded to just ['en', 'te', 'hi'] - every other language
  // (including ones the sidebar already supported, like Tamil or Urdu)
  // failed to save here with a Mongoose validation error the moment
  // someone picked that AI Reader tab. Now pulls the full list from
  // utils/languages.js so it can never drift out of sync again.
  language: { type: String, enum: SUPPORTED_LANGUAGES, required: true },
  summary: { type: String, required: true },
  keyPoints: { type: [String], default: [] },
  readerContent: { type: String, default: '' }
}, { timestamps: true });

// One cached reader per article+language combination.
articleReaderSchema.index({ articleId: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('ArticleReader', articleReaderSchema);
