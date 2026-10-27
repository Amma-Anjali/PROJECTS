// Single source of truth for every language NewsLens supports - the
// sidebar language switcher, the per-article AI Reader language tabs,
// the AI prompt's language name, the Article/ArticleReader Mongoose
// enums, and the browser speechSynthesis language code all read from
// this one list. Previously these lived as separate hardcoded lists in
// newsService.js, aiService.js, article.ejs, main.js and two model
// files - adding a language meant editing six places, and missing one
// (the ArticleReader enum only had en/te/hi) is exactly what made the
// AI Reader fail for every other language even though the sidebar
// already offered it. Add a language here once and every one of those
// picks it up automatically.
//
// code:   ISO 639-1 code used everywhere internally (session, DB, URLs)
// label:  shown in the UI, written in the language's own script
// name:   English name of the language, used inside the AI prompt so
//         the model knows unambiguously what to write in
// speech: BCP-47 tag passed to SpeechSynthesisUtterance.lang
//
// Scoped down to English + 5 (Hindi, Telugu, Spanish, Arabic, Russian)
// after 21 languages spread across a single general feed each proved
// too thin to reliably populate 11 categories - fewer languages means
// more real content concentrated in each one, so what's here actually
// works end to end instead of mostly showing "no articles yet".
const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', name: 'English', speech: 'en-US' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi', speech: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', name: 'Telugu', speech: 'te-IN' },
  { code: 'es', label: 'Español', name: 'Spanish', speech: 'es-ES' },
  { code: 'ar', label: 'العربية', name: 'Arabic', speech: 'ar-SA' },
  { code: 'ru', label: 'Русский', name: 'Russian', speech: 'ru-RU' }
];

const SUPPORTED_LANGUAGES = LANGUAGE_OPTIONS.map((l) => l.code);

module.exports = { LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES };
