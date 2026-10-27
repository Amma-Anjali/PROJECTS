// Run with: npm run seed
// Connects to MongoDB, pulls every configured RSS feed - English
// categories plus every non-English language's general feed (see
// utils/languages.js for the full list) - saves new articles, then
// exits. Handy to run once after setup, or any time you want fresh
// articles without waiting for a scheduled refresh.
require('dotenv').config();
const mongoose = require('mongoose');
const { refreshAllCategories, refreshAllLanguages } = require('../services/newsService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Fetching news...');

  const enSummary = await refreshAllCategories();
  console.log('New English articles saved per category:', enSummary);

  const langSummary = await refreshAllLanguages();
  console.log('New articles saved per language:', langSummary);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
