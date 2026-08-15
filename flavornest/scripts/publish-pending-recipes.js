/**
 * One-time migration: the pending/approval moderation system has been
 * removed (see routes/recipeRoutes.js — recipes now publish immediately
 * on submission). Any recipe submitted BEFORE that change may still be
 * sitting at status "pending" or "rejected" in the database with no way
 * to approve it now that the admin approve endpoint is gone.
 *
 * Run this once to publish all of them:
 *   node scripts/publish-pending-recipes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flavornest';
  await mongoose.connect(uri);

  const result = await Recipe.updateMany(
    { status: { $in: ['pending', 'rejected'] } },
    { $set: { status: 'approved' } }
  );

  console.log(`Published ${result.modifiedCount} recipe(s) that were stuck pending/rejected.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
