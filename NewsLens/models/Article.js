const mongoose = require('mongoose');
const { SUPPORTED_LANGUAGES } = require('../utils/languages');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  url: { type: String, required: true },
  source: { type: String, required: true },
  category: { type: String, required: true, index: true },
  publishedAt: { type: Date, required: true },

  // Which language this article's title/description are actually
  // written in. 'en' articles come from the existing category RSS
  // feeds; every other code comes from a language-specific feed (see
  // services/newsService.js -> LANGUAGE_OPTIONS). Used to keep each
  // language's news feed separate rather than machine-translating
  // English headlines.
  language: {
    type: String,
    enum: SUPPORTED_LANGUAGES,
    default: 'en',
    index: true
  },

  // Used for duplicate detection: a simplified, lowercased version
  // of the title so two sources reporting the same story can be matched
  // without needing embeddings or semantic similarity.
  normalizedTitle: { type: String, required: true, index: true },

  // Simple signals used later for the Trending section.
  clickCount: { type: Number, default: 0 },
  saveCount: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

module.exports = mongoose.model('Article', articleSchema);
