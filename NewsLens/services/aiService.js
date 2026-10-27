const Summary = require('../models/Summary');
const ArticleReader = require('../models/ArticleReader');
const { LANGUAGE_OPTIONS } = require('../utils/languages');
const { ALL_CATEGORIES } = require('../utils/categories');

// Built from the shared language list instead of a hardcoded object.
// This used to only have en/te/hi, so every other language the sidebar
// already offered (ta, bn, mr, gu, pa, ur, ne, si) silently fell back
// to 'English' here and got English AI Reader content mislabeled as
// that language - deriving this from utils/languages.js is what
// actually fixes that, not just the new languages being added now.
const LANGUAGE_NAMES = Object.fromEntries(LANGUAGE_OPTIONS.map((l) => [l.code, l.name]));

// Calls Google AI Studio's Gemini API directly (no SDK, to keep
// dependencies minimal). Isolated here so the rest of the app never
// touches the AI provider directly - swap providers by editing only
// this function (this used to call Anthropic's Messages API the same
// way - see describeAiFailure below for why that isolation mattered
// when switching).
// generationConfig.responseMimeType asks Gemini to return raw JSON
// directly instead of prose-wrapped-in-fences, which is more reliable
// than the old "strip ```json fences and hope" approach.
async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
        // Gemini 2.5/3.x "flash" models think by default, and those
        // thinking tokens are billed against maxOutputTokens - the
        // model could spend its entire budget "thinking" and leave
        // nothing for the actual JSON answer, which is exactly what
        // produced empty/truncated output that failed to parse.
        // Structured JSON extraction doesn't need reasoning, so this
        // is switched off entirely rather than just raising the budget.
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini API error (${response.status}): ${errText}`);
    err.status = response.status;
    err.body = errText;
    throw err;
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];

  // A candidate can come back with no parts at all - most commonly
  // because Gemini's safety filters blocked the output (finishReason
  // "SAFETY" or "RECITATION") rather than because of a network/API
  // error, so this needs its own message rather than falling through
  // to a generic parse failure. Parts marked thought: true are
  // reasoning traces, not the answer - excluded even though
  // thinkingBudget: 0 above should already prevent them appearing.
  const text = candidate && candidate.content && candidate.content.parts
    ? candidate.content.parts.filter((part) => !part.thought).map((part) => part.text || '').join('')
    : '';

  if (!text) {
    const err = new Error(`Gemini returned no usable text (finishReason: ${(candidate && candidate.finishReason) || 'unknown'})`);
    err.body = JSON.stringify(data);
    throw err;
  }

  return text;
}

// Turns a raw API/parse failure into a short, specific, user-facing
// sentence instead of a generic "something went wrong". This is what
// actually gets shown under AI SUMMARY / AI READER, so the person
// running the app can tell at a glance whether it's a quota issue,
// a bad key, or something transient - without having to go read the
// server terminal every time.
function describeAiFailure(err) {
  const body = (err.body || '').toLowerCase();
  const message = (err.message || '').toLowerCase();

  if (!process.env.GEMINI_API_KEY) {
    return 'No GEMINI_API_KEY is set in .env, so AI features are turned off.';
  }
  if (err.status === 400 && (body.includes('api key not valid') || body.includes('api_key_invalid'))) {
    return 'The GEMINI_API_KEY in .env is invalid. Generate a new one at aistudio.google.com/apikey and update .env.';
  }
  if (err.status === 404 && (body.includes('is not found') || body.includes('no longer available'))) {
    return `The model "${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}" set in GEMINI_MODEL isn't available anymore. Check aistudio.google.com for the current model name and update .env.`;
  }
  if (err.status === 403) {
    return 'The GEMINI_API_KEY in .env does not have access to this model, or the Generative Language API isn\'t enabled for it. Check aistudio.google.com/apikey.';
  }
  if (err.status === 429 || body.includes('resource_exhausted') || body.includes('quota')) {
    return 'The Gemini API free-tier quota has been used up for now. Wait a bit and try again, or check your limits at aistudio.google.com.';
  }
  if (err.status === 503 || body.includes('overloaded') || body.includes('unavailable')) {
    return "Google's Gemini API is temporarily overloaded. Try again shortly.";
  }
  if (message.includes('finishreason') && body.includes('safety')) {
    return "Gemini's safety filters blocked a response for this article. Try a different article.";
  }
  if (err instanceof SyntaxError || message.includes('json')) {
    return "The AI's response was too long and got cut off before finishing, so it couldn't be read as JSON. Try again, or shorten the source article.";
  }
  // Anything else (e.g. a 404 for a renamed/retired model, a malformed
  // request) - show the provider's own error text right in the UI
  // instead of a vague "check the terminal", so this is diagnosable
  // from the browser alone. Truncated since Google's error bodies can
  // be long JSON blobs.
  const detail = (err.body || err.message || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  return `The AI service returned an unexpected error${err.status ? ` (HTTP ${err.status})` : ''}${detail ? `: ${detail}` : ''}`;
}

// Asks the model for a summary + key points, and parses its response.
// The prompt asks for strict JSON so parsing stays simple and reliable.
async function generateSummary(article) {
  const prompt = `Summarize this news article in JSON only, no other text.
Format: {"summary": "3-4 sentence summary", "keyPoints": ["point 1", "point 2", "point 3"]}

Title: ${article.title}
Description: ${article.description}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints || []
  };
}

// Returns the cached summary if one exists; otherwise generates it,
// saves it, and returns it. This is the important engineering
// requirement from the spec: never call the AI API more than once
// per article. On failure, returns a plain (non-DB) object carrying a
// specific, human-readable reason instead of silently returning null -
// see describeAiFailure above.
async function getOrCreateSummary(article) {
  const cached = await Summary.findOne({ articleId: article._id });
  if (cached) return cached;

  try {
    const { summary, keyPoints } = await generateSummary(article);
    return await Summary.create({ articleId: article._id, summary, keyPoints });
  } catch (err) {
    // Two requests for the same uncached article (a page load racing a
    // prefetch, a double-click, two browser tabs) can both pass the
    // findOne check above before either finishes writing - the second
    // create() then collides with the unique index on articleId. That's
    // not a real failure, just a lost race - whoever won already saved
    // a good summary, so fetch and return that instead of showing an
    // error for something that actually succeeded.
    if (err.code === 11000) {
      const winner = await Summary.findOne({ articleId: article._id });
      if (winner) return winner;
    }
    console.error('[aiService] Summary generation failed:', err.message);
    // Don't crash the article page just because the AI call failed -
    // hand back the reason so the page can explain it instead.
    return { failureReason: describeAiFailure(err) };
  }
}

// Multilingual "AI Reader": a summary + key points + a reader-friendly
// retelling of the article, all written natively in the requested
// language (not a translation pass over English text). Same strict-JSON
// pattern as generateSummary above, just with a language instruction
// and one extra field.
async function generateArticleReader(article, language) {
  const languageName = LANGUAGE_NAMES[language] || 'English';
  const prompt = `You are a multilingual news reading assistant. Write your entire response in ${languageName} (using the ${languageName} script), in JSON only, no other text, no markdown fences.
Format: {"summary": "3-4 sentence summary in ${languageName}", "keyPoints": ["point 1", "point 2", "point 3"], "readerContent": "a clear, reader-friendly retelling of the article in ${languageName}, 2-3 short paragraphs, based only on the information given below"}

Title: ${article.title}
Description: ${article.description}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints || [],
    readerContent: parsed.readerContent || ''
  };
}

// Same cache-first pattern as getOrCreateSummary, keyed by
// (articleId, language) so each language is only generated once per
// article and every later request/visitor reuses the cached row. On
// failure, returns { error: <specific reason> } instead of null.
async function getOrCreateArticleReader(article, language) {
  const cached = await ArticleReader.findOne({ articleId: article._id, language });
  if (cached) return cached;

  try {
    const { summary, keyPoints, readerContent } = await generateArticleReader(article, language);
    return await ArticleReader.create({ articleId: article._id, language, summary, keyPoints, readerContent });
  } catch (err) {
    // Same lost-race case as getOrCreateSummary above, just keyed by
    // (articleId, language) instead of articleId alone - e.g. clicking
    // a language tab twice quickly before the first request finishes.
    if (err.code === 11000) {
      const winner = await ArticleReader.findOne({ articleId: article._id, language });
      if (winner) return winner;
    }
    console.error('[aiService] Article reader generation failed:', err.message);
    return { error: describeAiFailure(err) };
  }
}

// Classifies a whole batch of non-English headlines into our category
// slugs in one call (see categorizeGeneralArticles in newsService.js
// for why batching instead of one call per article). Returns an array
// of category strings in the same order as the input, or throws on
// failure - the caller already has a keyword-based fallback for that.
async function classifyCategoriesForLanguage(articles, languageName) {
  const list = articles
    .map((a, i) => `${i + 1}. ${a.title}${a.description ? ' - ' + a.description.slice(0, 150) : ''}`)
    .join('\n');

  const prompt = `These are ${languageName}-language news headlines. Classify each one into exactly one of these categories: ${ALL_CATEGORIES.join(', ')}, general.
Respond in JSON only, no other text: {"categories": ["category for headline 1", "category for headline 2", ...]}
The array must have exactly ${articles.length} entries, in the same order as the headlines below.

${list}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  // Despite the prompt asking for {"categories": [...]}, a model can
  // sometimes just return the bare array instead of wrapping it - the
  // old code only checked parsed.categories and silently returned []
  // on that shape, which meant every article fell through to the
  // (much weaker) keyword fallback with no error or log anywhere to
  // show that had happened. Accept either shape, and log a warning
  // (not silence) for anything that still doesn't match what we asked
  // for, so a real mismatch is visible in the terminal instead of
  // masquerading as "the feed just doesn't have that content".
  const categories = Array.isArray(parsed) ? parsed : parsed.categories;
  if (!Array.isArray(categories)) {
    console.error(`[aiService] classifyCategoriesForLanguage got an unexpected shape back:`, cleaned.slice(0, 300));
    return [];
  }
  if (categories.length !== articles.length) {
    console.error(`[aiService] classifyCategoriesForLanguage returned ${categories.length} categories for ${articles.length} headlines - lengths should match.`);
  }
  return categories;
}

module.exports = { getOrCreateSummary, getOrCreateArticleReader, classifyCategoriesForLanguage };
