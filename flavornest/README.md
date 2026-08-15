# FlavorNest — Global Kitchen (Backend Edition)

A full-stack recipe & food-culture platform. What started as a static HTML/CSS/JS
demo is now backed by a real **Node.js + Express + MongoDB** API with auth,
a recommendation engine, a meal planner, and an admin analytics dashboard.

## What's new vs. the original static version

| Area | Before | Now |
|---|---|---|
| Data | 10 recipes hardcoded in `script.js` | MongoDB collection, seeded + user-submitted |
| Favorites | `localStorage` only | Persisted per-account via the API |
| Search/filter | Client-side `.filter()` | Server-side text index + query params + pagination |
| "AI Chef" pantry match | Simple client-side keyword match | Server-side scoring engine (`utils/recommend.js`) |
| Auth | None | Cookie-based sessions (register/login/logout), bcrypt hashing, password reset via emailed token |
| Recipe submissions | Not possible | Logged-in users can submit; admin moderation queue |
| Ratings/reviews | Not possible | Full CRUD reviews, recalculated average rating |
| Meal planning | Not possible | Weekly planner + auto-generated shopping list |
| Nutrition | Not shown | Heuristic per-serving calorie/macro estimate |
| Trending | Not shown | Weighted trending score with recency decay, recalculated by a nightly cron job |
| Culture facts | Not shown | "Culture Encyclopedia" API + UI panel per cuisine |
| Analytics | Not shown | Admin dashboard: totals, by-cuisine breakdown, top viewed/rated |
| Ordering | Not possible | Cart, checkout, Stripe payments (test mode), order tracking, PDF invoices |
| Real-time updates | None | Socket.io: live order status, admin live feed, in-app notification bell |
| Email | None | Welcome email, order confirmation/status, password reset (mock-mode by default) |
| Security | None | helmet, rate limiting, mongo-sanitize, input validation |

## Tech stack

- **Backend:** Node.js, Express, MongoDB + Mongoose
- **Auth:** Cookie-based sessions (`express-session` + `connect-mongo`), bcryptjs, password reset via time-limited hashed tokens. No secrets to configure — a safe default is baked in, override with `SESSION_SECRET` in `.env` if you want to.
- **Real-time:** Socket.io, authenticated via the same session cookie as the rest of the app (no separate token)
- **Email:** Nodemailer (mock-mode console logging by default, drop-in real SMTP)
- **Payments:** Stripe (test mode; mock-mode by default, no account required)
- **Uploads:** Multer (recipe images)
- **Scheduling:** node-cron (trending score decay)
- **Validation/security:** express-validator, helmet, express-rate-limit, express-mongo-sanitize
- **Frontend:** Vanilla HTML/CSS/JS (no build step) consuming the REST API via `fetch`, Socket.io client

## Getting started

```bash
cd flavornest
npm install
cp .env.example .env      # optional - sensible defaults are built in
npm run seed               # populates recipes + demo admin/user accounts
npm run dev                 # nodemon, or `npm start` for plain node
```

Visit `http://localhost:8080`. Demo accounts created by the seed script:

- **Admin:** `admin@flavornest.com` / `admin123` (see `/admin.html` for the dashboard)
- **User:** `demo@flavornest.com` / `demo1234`

That's it — no required environment variables. `.env` lets you customize things
(MongoDB URI, SMTP, Stripe keys) but the app runs correctly without editing it
at all: sessions use a built-in default secret, payments and email run in mock
mode, and Mongo defaults to `mongodb://127.0.0.1:27017/flavornest`.

## API overview

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password    — { email } — always returns success, doesn't leak account existence
POST   /api/auth/reset-password/:token  — { password }
GET    /api/auth/me
PUT    /api/auth/preferences

GET    /api/recipes                 ?search=&cuisine=&difficulty=&maxTime=&diet=&sort=&page=&limit=
GET    /api/recipes/pantry-match    ?ingredients=chicken,rice,garlic
GET    /api/recipes/pending         (admin)
GET    /api/recipes/:id
POST   /api/recipes                 (auth) — submits as "pending" unless admin
PUT    /api/recipes/:id             (owner/admin)
DELETE /api/recipes/:id             (owner/admin)
PUT    /api/recipes/:id/approve     (admin) — { status: "approved" | "rejected" }
POST   /api/recipes/:id/favorite    (auth) — toggle

GET    /api/reviews/:recipeId
POST   /api/reviews/:recipeId       (auth)
DELETE /api/reviews/:id             (owner/admin)

GET    /api/mealplan                (auth)
PUT    /api/mealplan/:day           (auth) — { recipeId }
GET    /api/mealplan/shopping-list  (auth)

GET    /api/analytics/trending
GET    /api/analytics/overview      (admin)

GET    /api/culture
GET    /api/culture/:name

GET    /api/cart                    (auth)
POST   /api/cart/items              (auth) — { recipeId, quantity } (quantity<=0 removes)
DELETE /api/cart/items/:recipeId    (auth)
DELETE /api/cart                    (auth) — clear

GET    /api/orders/config           — Stripe publishable key + mock-mode flag
POST   /api/orders/checkout         (auth) — creates order + PaymentIntent from the cart
POST   /api/orders/:id/confirm-payment  (auth)
GET    /api/orders                  (auth) — my orders
GET    /api/orders/admin/all        (admin)
GET    /api/orders/:id              (owner/admin)
PUT    /api/orders/:id/status       (admin) — advance order tracking status
GET    /api/orders/:id/invoice      (owner/admin) — downloads a PDF invoice

GET    /api/notifications           (auth) — recent notifications + unread count
PUT    /api/notifications/:id/read  (auth)
PUT    /api/notifications/read-all  (auth)
```

## Auth (sessions, not tokens)

Login/register set `req.session.userId` and the browser stores a signed,
`httpOnly` session cookie automatically — there's no token to store in
`localStorage` or attach to headers. Every `fetch` call in the frontend just
uses `credentials: 'include'` and the cookie goes along for the ride. Sessions
are persisted in MongoDB (via `connect-mongo`) so logins survive a server
restart. `POST /api/auth/logout` destroys the session server-side.

## Real-time (Socket.io)

Socket connections are authenticated with the same session cookie as the rest
of the app (`io({ withCredentials: true })` on the client) — no separate
token. Each socket joins a `user:<id>` room (plus `admins` if applicable).
Events:

- `notification` — pushed to a user whenever `utils/notify.js` creates one
  (order confirmed, order status changed, recipe approved/rejected)
- `order:status` — pushed to the order's owner when an admin updates status;
  `/orders.html` listens for this and updates the tracking timeline live,
  no refresh needed
- `order:new` / `recipe:pending` — pushed to everyone in the `admins` room;
  `/admin.html` uses these to show a live banner and refresh its lists

## Project structure

```
flavornest/
├── server.js               # app entry point (HTTP server + Socket.io)
├── config/db.js            # Mongo connection
├── config/socket.js        # Socket.io init, shares the session cookie for auth
├── models/                 # User, Recipe, Review, MealPlan, Cart, Order, Notification
├── routes/                 # one file per resource
├── middleware/              # auth (sessions), session.js (shared config), upload (multer), error handler
├── utils/                   # recommend.js, nutrition.js, trending.js, payment.js, email.js, invoice.js, notify.js
├── data/cultureFacts.js     # static culture encyclopedia content
├── jobs/trendingDecay.js    # node-cron nightly recompute
├── seed/                    # seed data + seed script
└── public/                  # static frontend (index.html, styles.css, script.js, admin.html, orders.html)
```

## Payments (Stripe test mode)

Checkout works out of the box with **no Stripe account** — `STRIPE_SECRET_KEY=sk_test_mock`
(the `.env.example` default) puts the whole cart → checkout → order flow into a
mock mode where "payment" succeeds instantly, so you can demo the entire
ordering system immediately.

To use real Stripe test-mode payments instead:
1. Create a free Stripe account, grab your **test** keys from the dashboard.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in `.env` to those test keys.
3. Restart the server. The frontend automatically switches to a real Stripe
   Elements card field (test card: `4242 4242 4242 4242`, any future date/CVC).

Order tracking statuses (`placed → preparing → out_for_delivery → delivered`,
or `cancelled`) are updated by an admin from `/admin.html`, and reflected live
on the customer's `/orders.html` page. Each order has a downloadable PDF invoice.

## Email (mock mode by default)

Like payments, email works with zero setup: leaving `SMTP_HOST` unset in
`.env` logs every email to the server console instead of sending it, so
registration, checkout, and password reset all work end-to-end without an
email provider. To send real email, set `SMTP_HOST` / `SMTP_PORT` /
`SMTP_USER` / `SMTP_PASS` in `.env` to any standard SMTP provider (Gmail app
password, Mailtrap, SendGrid, etc.) and restart.

## Notes

- The nutrition estimator and pantry-match/recommendation engine are both
  implemented in-house (no external AI/nutrition API key required).
- `npm run seed:destroy` wipes all collections without reseeding.
- Uploaded recipe images are written to `/uploads` and served statically.
