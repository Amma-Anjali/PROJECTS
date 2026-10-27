// The full set of category slugs the app knows about. This mirrors the
// keys of FEEDS_BY_CATEGORY in newsService.js (English has a real,
// dedicated RSS feed for each one) but lives in its own file so
// aiService.js can use the same list for AI-based categorization of
// non-English articles without newsService.js and aiService.js having
// to require each other.
const ALL_CATEGORIES = ['ai', 'technology', 'business', 'india', 'world', 'science', 'sports', 'health', 'culture', 'politics', 'gaming'];

module.exports = { ALL_CATEGORIES };
