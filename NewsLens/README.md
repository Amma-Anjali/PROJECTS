# NewsLens — Smart News Dashboard

A news aggregation dashboard: pulls articles from multiple RSS sources,
lets you browse by category, search, save articles, and generates
AI summaries + key points for each one.

> "I want to know what is happening without opening 10 different news websites."

## Architecture

MVC + service layer, exactly as planned:

```
Browser → EJS/JS → Express Routes → Controllers → Services → Mongoose Models → MongoDB
```

Provider-specific code (RSS parsing, the Gemini API call) is isolated
inside `services/`, so the rest of the app never talks to an external
API directly.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI, SESSION_SECRET, and GEMINI_API_KEY
npm run seed            # pulls the first batch of articles from RSS feeds
npm run dev
```

Then open http://localhost:3000.

- `MONGODB_URI` — your local or Atlas MongoDB connection string
- `SESSION_SECRET` — any long random string
- `GEMINI_API_KEY` — a Google AI Studio key (aistudio.google.com/apikey),
  used for article summaries and the AI Reader. If it's missing or the
  call fails, article pages still work — they just show "couldn't
  generate a summary" instead of crashing.
- `GEMINI_MODEL` — which Gemini model to call (defaults to
  `gemini-2.5-flash` if unset).

Re-run `npm run seed` any time you want fresh articles (no scheduler is
set up - keeping it simple and explicit for now).

## Folder structure

```
newslens/
├── app.js                  Express app, middleware, route mounting
├── config/db.js             Mongoose connection
├── controllers/             Route handlers (auth, news, saved, summary, profile)
├── models/                  User, Article, Summary, ReadingHistory
├── routes/                  One file per resource
├── services/
│   ├── newsService.js       RSS fetch → normalize → dedupe → save
│   └── aiService.js         Anthropic API call + summary caching
├── middleware/auth.js       requireAuth guard, currentUser for views
├── utils/                   textHelpers (normalize/dedupe, reading time,
│                             "time ago"), asyncHandler
├── scripts/fetchNews.js     CLI: npm run seed
├── views/                   EJS templates + partials
└── public/                  CSS, client JS
```

## Feature checklist (what's implemented)

- [x] Multi-source RSS ingestion, normalized into a common Article shape
- [x] Duplicate detection via normalized-title matching (no embeddings)
- [x] Per-source failure isolation (one dead feed doesn't break ingestion)
- [x] Categories: AI, Technology, Business, India, World, Science, Sports
- [x] Search (MongoDB regex query on title/description)
- [x] Register / login / logout, bcrypt-hashed passwords, sessions
- [x] Save / unsave articles, duplicate-save prevented
- [x] "For You" - rule-based matching on chosen interests, no ML
- [x] Trending - simple recency + click + save score, resorted per request
- [x] Reading history - last 20 viewed articles
- [x] Estimated reading time (word count / 200wpm)
- [x] AI summary + key points, generated once and cached in MongoDB
- [x] Loading/empty/error states, custom 404 and 500 pages
- [x] Centralized async error handling (no raw stack traces to users)

## Design decisions worth mentioning in interviews

- **Provider isolation**: RSS parsing lives entirely in `newsService.js`.
  Swapping to a different provider, or adding a paid news API later,
  touches one file.
- **AI caching**: summaries are stored in MongoDB and only regenerated
  on request (`POST /summary/:id`), so repeat views never re-call the
  AI API.
- **Rule-based personalization**: "For You" matches `user.interests`
  against `article.category` directly - no recommendation model, because
  the requirement doesn't justify one.
- **Duplicate handling**: titles are normalized (lowercased, punctuation
  stripped) into a `normalizedTitle` field used as the dedupe key.
- **Async error safety**: every controller is wrapped in a small
  `asyncHandler` so a failed DB or API call reaches the centralized
  error page instead of crashing the process.
- **DELETE vs POST for unsave**: the spec listed `DELETE /saved/:id`,
  but plain HTML forms can't send DELETE without extra middleware
  (`method-override`), which isn't worth the complexity here. Unsave
  is a `POST /saved/:id/remove` instead - same behavior, one fewer
  dependency.

## Known limitations / next steps

- No scheduled ingestion - `npm run seed` is manual. A cron job or
  `node-cron` call would be the natural next step if this became a
  real service.
- RSS feed list is hardcoded in `newsService.js` - fine for a handful
  of sources, would move to a config file or DB collection if it grew.
- I built and syntax-checked this without a live network connection,
  so `npm install` / the first real run may surface small issues
  (missing punctuation in a template, an RSS feed URL that's moved,
  etc.) - if something breaks, share the exact error and it's a quick fix.
