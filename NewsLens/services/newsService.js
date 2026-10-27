const Parser = require('rss-parser');
const Article = require('../models/Article');
const { normalizeTitle } = require('../utils/textHelpers');
const { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES } = require('../utils/languages');
const { ALL_CATEGORIES } = require('../utils/categories');
const { classifyCategoriesForLanguage } = require('./aiService');

// BBC's own feeds (and most others) publish article images as
// <media:thumbnail>, which rss-parser doesn't pull out by default -
// only registered custom fields get attached to each item. Without
// this, every BBC-sourced article (the majority of our feeds) came
// back with no image at all.
const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContentTag']
    ]
  }
});

// Free, public RSS feeds - no API key required. One or more feeds per
// category, so a single dead feed doesn't wipe out a whole category.
// Swap or add feeds here without touching any other code (that's the
// point of isolating provider details inside this service).
// These are all English-language sources.
const FEEDS_BY_CATEGORY = {
  ai: [
    'https://www.technologyreview.com/topic/artificial-intelligence/feed'
  ],
  technology: [
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://www.theverge.com/rss/index.xml'
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml'
  ],
  india: [
    'https://feeds.bbci.co.uk/news/world/asia/india/rss.xml'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml'
  ],
  science: [
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'
  ],
  sports: [
    'https://feeds.bbci.co.uk/sport/rss.xml'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml'
  ],
  culture: [
    'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'
  ],
  politics: [
    'https://feeds.bbci.co.uk/news/politics/rss.xml'
  ],
  gaming: [
    'https://www.theverge.com/rss/games/index.xml'
  ]
};

// Real, native-language news sources - not machine translation. All
// are genuine BBC-language newsrooms, not BBC English translated. The
// full list of supported languages (code/label/AI-prompt name/speech
// code) now lives in utils/languages.js - a single shared source, so
// this file only needs to say which RSS feed backs each non-English
// language. Every non-English language currently gets one general feed
// rather than per-category ones, since that's what's available - add
// more feeds per language here if deeper category coverage shows up
// later.
//
// NOTE: these BBC feed slugs are believed correct (BBC's language
// service naming, e.g. "turkce" for Turkish, "mundo" for Spanish) but
// haven't been live-verified from this environment (no outbound
// network access here). fetchFeed() below never throws on a dead or
// renamed feed - it just logs and returns zero articles for that
// language - so a wrong slug degrades gracefully instead of breaking
// anything. If a specific language's feed ever comes back empty, check
// this URL against BBC's current feed list.
const FEEDS_BY_LANGUAGE = {
  hi: ['https://feeds.bbci.co.uk/hindi/rss.xml'],
  te: ['https://feeds.bbci.co.uk/telugu/rss.xml'],
  es: ['https://feeds.bbci.co.uk/mundo/rss.xml'],
  ar: ['https://feeds.bbci.co.uk/arabic/rss.xml'],
  ru: ['https://feeds.bbci.co.uk/russian/rss.xml']
};

const GENERAL_CATEGORY = 'general';

// BBC's non-English feeds turned out not to carry usable <category>
// tags at all (confirmed by testing - Ukrainian "Business" came back
// empty even though real Ukrainian business stories exist in the
// general feed), so classifying by feed metadata doesn't work here.
// This instead keyword-matches each article's own title+description
// against a short list of native-language words per category, per
// language - the same idea as English's category feeds, just done by
// content instead of by URL.
//
// Honesty note: these word lists are my best-effort translations for
// the more distinctive category words (technology, business, sports,
// health, science, politics) in each script, written from general
// knowledge rather than checked against live articles. They should
// catch a meaningful share of matches, not all of them - a language's
// category pages may still look thin if its news doesn't happen to use
// these exact words, and 'world'/'india'/'ai'/'gaming' aren't attempted
// at all for non-English (too easy to mistranslate, too easy to
// silently misclassify) - those stay in 'general' for every language
// except English, which still gets them from its own feeds.
const NATIVE_CATEGORY_KEYWORDS = {
  hi: { technology: ['तकनीक', 'प्रौद्योगिकी'], business: ['व्यापार', 'अर्थव्यवस्था', 'कारोबार'], sports: ['खेल', 'क्रिकेट'], health: ['स्वास्थ्य'], science: ['विज्ञान'], politics: ['राजनीति'], culture: ['मनोरंजन', 'सिनेमा', 'फिल्म'] },
  te: { technology: ['సాంకేతిక', 'టెక్నాలజీ'], business: ['వ్యాపారం', 'ఆర్థిక'], sports: ['క్రీడలు', 'క్రికెట్'], health: ['ఆరోగ్య'], science: ['విజ్ఞాన', 'సైన్స్'], politics: ['రాజకీయ'], culture: ['వినోదం', 'సినిమా'] },
  ar: { technology: ['تكنولوجيا', 'تقنية'], business: ['اقتصاد', 'أعمال'], sports: ['رياضة'], health: ['صحة'], science: ['علوم'], politics: ['سياسة'], culture: ['ترفيه', 'فن'] },
  ru: { technology: ['технолог'], business: ['бизнес', 'экономик'], sports: ['спорт'], health: ['здоровь'], science: ['наук'], politics: ['политик'], culture: ['культур', 'развлечен'] },
  es: { technology: ['tecnología'], business: ['negocio', 'economía'], sports: ['deporte'], health: ['salud'], science: ['ciencia'], politics: ['política'], culture: ['entretenimiento', 'cultura'] }
};

function classifyByNativeKeywords(article, language) {
  const wordsByCategory = NATIVE_CATEGORY_KEYWORDS[language];
  if (!wordsByCategory) return null;
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  for (const category of ALL_CATEGORIES) {
    const words = wordsByCategory[category];
    if (words && words.some((word) => text.includes(word.toLowerCase()))) return category;
  }
  return null;
}

// Categories are offered for every language - each one falls back to
// 'general' for any article that doesn't get classified, same graceful
// behavior as before.
function getCategoriesForLanguage() {
  return ALL_CATEGORIES;
}

// Hand-written keyword lists (classifyByNativeKeywords) turned out to
// only ever catch a handful of articles per language - each general
// feed is small, and no fixed word list covers real news phrasing
// well. This asks Gemini to read the whole batch of headlines for a
// language at once (one API call per language, not per article - a
// full seed run across ~20 languages stays well within Google AI
// Studio's free-tier rate limit) and pick a category per headline
// directly from the real text. classifyByNativeKeywords is kept as
// the fallback for when there's no GEMINI_API_KEY, or the AI call
// fails/hits a quota - graceful degradation, not a hard dependency.
async function categorizeGeneralArticles(articles, language) {
  if (!articles.length) return;

  let aiCategories = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const languageOption = LANGUAGE_OPTIONS.find((l) => l.code === language);
      aiCategories = await classifyCategoriesForLanguage(articles, languageOption ? languageOption.name : language);
    } catch (err) {
      console.error(`[newsService] AI categorization failed for ${language}, falling back to keyword matching:`, err.message);
    }
  } else {
    console.warn(`[newsService] No GEMINI_API_KEY set - categorizing ${language} with keyword matching only, which catches far fewer articles.`);
  }

  articles.forEach((article, i) => {
    const aiPick = aiCategories && aiCategories[i];
    article.category = (aiPick && ALL_CATEGORIES.includes(aiPick))
      ? aiPick
      : (classifyByNativeKeywords(article, language) || GENERAL_CATEGORY);
  });

  // Visible in the npm run seed output either way - so an empty
  // category page can be checked against what was actually assigned,
  // instead of guessing whether classification ran at all.
  const counts = {};
  articles.forEach((a) => { counts[a.category] = (counts[a.category] || 0) + 1; });
  console.log(`[newsService] ${language}: classified ${articles.length} articles ->`, counts);
}

// Pulls one RSS feed and normalizes each entry into our Article shape.
// Never throws - a broken feed just returns an empty array, so one bad
// provider can't take down the whole ingestion run.
async function fetchFeed(url, category, language = 'en') {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      description: (item.contentSnippet || item.content || '').slice(0, 500),
      image: extractImage(item),
      url: item.link,
      source: feed.title || new URL(url).hostname,
      // English feeds already know their category from which feed they
      // came from. Non-English feeds all start as GENERAL_CATEGORY here
      // and get a real category assigned afterwards by
      // categorizeGeneralArticles, once the whole batch is in hand.
      category,
      language,
      publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      normalizedTitle: normalizeTitle(item.title || '')
    }));
  } catch (err) {
    console.error(`[newsService] Failed to fetch ${url}:`, err.message);
    return []; // Source B and C should still work even if A is down
  }
}

// Pulls a url out of a media:thumbnail / media:content style field,
// which rss-parser hands back as a single {$: {url}} object OR, when a
// feed lists several sizes of the same image (BBC often does: a small
// and a large thumbnail per item), as an ARRAY of those objects. The
// old code only handled the single-object shape, so on any feed that
// used the array form, `.mediaThumbnail.$.url` was reading `.$` off an
// array and getting undefined - silently producing no image at all for
// every article from that feed. This is the actual "images aren't
// showing" bug for most affected sources.
function firstMediaUrl(field) {
  if (!field) return '';
  const first = Array.isArray(field) ? field[0] : field;
  return (first && first.$ && first.$.url) || '';
}

// Last-resort fallback: some feeds (e.g. WordPress-based sources like
// The Verge) don't use <enclosure> or <media:*> tags at all - the image
// is just an <img> sitting inside the HTML of the article's own
// content/summary field. Pull the first one out of there if nothing
// else matched.
function firstImageFromHtml(html) {
  if (!html) return '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

// RSS items store images inconsistently across providers - check every
// common spot: a plain <enclosure>, <media:thumbnail>/<media:content>
// (single or array), then fall back to an <img> tag buried in the
// article's own HTML content.
function extractImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;

  const fromThumbnail = firstMediaUrl(item.mediaThumbnail);
  if (fromThumbnail) return fromThumbnail;

  const fromContentTag = firstMediaUrl(item.mediaContentTag);
  if (fromContentTag) return fromContentTag;

  const fromMediaContent = firstMediaUrl(item['media:content']);
  if (fromMediaContent) return fromMediaContent;

  return firstImageFromHtml(item['content:encoded'] || item.content || item.contentSnippet || '');
}

// Saves whichever normalized articles haven't been seen before
// (matched by normalizedTitle, same de-dup rule for every language).
// Also backfills an already-saved article's image and/or category if
// they were missing/generic and this run's parse found better values -
// covers articles saved before extractImage()/classifyByNativeKeywords()
// existed, which dedup would otherwise leave stuck that way forever.
async function saveNewArticles(articles) {
  let savedCount = 0;
  for (const article of articles) {
    const existing = await Article.findOne({ normalizedTitle: article.normalizedTitle });
    if (!existing) {
      await Article.create(article);
      savedCount += 1;
      continue;
    }
    let changed = false;
    if (!existing.image && article.image) {
      existing.image = article.image;
      changed = true;
    }
    if (existing.category === GENERAL_CATEGORY && article.category !== GENERAL_CATEGORY) {
      existing.category = article.category;
      changed = true;
    }
    if (changed) await existing.save();
  }
  return savedCount;
}

// Fetches every configured English feed for a category and saves new
// articles.
async function refreshCategory(category) {
  const feedUrls = FEEDS_BY_CATEGORY[category] || [];
  const results = await Promise.all(feedUrls.map((url) => fetchFeed(url, category, 'en')));
  return saveNewArticles(results.flat());
}

async function refreshAllCategories() {
  const summary = {};
  for (const category of ALL_CATEGORIES) {
    summary[category] = await refreshCategory(category);
  }
  return summary;
}

// Fetches every configured feed for a non-English language, then
// classifies the whole batch into real categories (see
// categorizeGeneralArticles above) before saving.
async function refreshLanguage(language) {
  const feedUrls = FEEDS_BY_LANGUAGE[language] || [];
  const results = await Promise.all(feedUrls.map((url) => fetchFeed(url, GENERAL_CATEGORY, language)));
  const articles = results.flat();
  await categorizeGeneralArticles(articles, language);
  return saveNewArticles(articles);
}

async function refreshAllLanguages() {
  const summary = {};
  for (const language of Object.keys(FEEDS_BY_LANGUAGE)) {
    summary[language] = await refreshLanguage(language);
  }
  return summary;
}

// Single entry point used by the seed script: fetchNews('en', 'technology'),
// fetchNews('en') for every English category, or fetchNews('hi') / fetchNews('ta')
// / etc for that language's general feed.
async function fetchNews(language = 'en', category) {
  if (language === 'en') {
    return category ? { [category]: await refreshCategory(category) } : refreshAllCategories();
  }
  return { [language]: await refreshLanguage(language) };
}

module.exports = {
  refreshCategory,
  refreshAllCategories,
  refreshLanguage,
  refreshAllLanguages,
  fetchNews,
  ALL_CATEGORIES,
  SUPPORTED_LANGUAGES,
  LANGUAGE_OPTIONS,
  GENERAL_CATEGORY,
  getCategoriesForLanguage
};
