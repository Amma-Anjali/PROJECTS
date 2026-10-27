// Small, dependency-free helpers shared across services and controllers.

// Turns a headline into a simple key so the same story from two
// different sources can be recognised as a duplicate. No embeddings,
// no semantic similarity - just lowercase + strip punctuation/spacing.
// \p{L}/\p{N} (Unicode letter/number properties, "u" flag) matter here:
// a plain a-z/0-9 filter strips every character in non-Latin scripts
// like Telugu or Devanagari, leaving an empty string for every headline
// - which made every Telugu/Hindi article look like a duplicate of the
// first one ever saved. That was the actual cause of "trending/home is
// empty" for non-English languages.
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // drop punctuation, keep letters/numbers in any script
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

// Rough reading time estimate from plain text, assuming ~200 words/min.
function estimateReadingTime(text) {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Turns a Date into a short "time ago" string for article meta lines.
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

module.exports = { normalizeTitle, estimateReadingTime, timeAgo };
