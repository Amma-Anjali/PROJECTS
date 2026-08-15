require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Review = require('../models/Review');
const MealPlan = require('../models/MealPlan');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const recipesData = require('./recipesData');
const { estimateNutrition } = require('../utils/nutrition');
const { computeTrendingScore } = require('../utils/trending');

async function run() {
  await connectDB();

  if (process.argv.includes('--destroy')) {
    await Promise.all([
      Recipe.deleteMany(),
      User.deleteMany(),
      Review.deleteMany(),
      MealPlan.deleteMany(),
      Cart.deleteMany(),
      Order.deleteMany(),
    ]);
    console.log('🗑️  All collections cleared.');
    process.exit(0);
  }

  console.log('🌱 Seeding FlavorNest database...');

  await Promise.all([
    Recipe.deleteMany(),
    User.deleteMany(),
    Review.deleteMany(),
    MealPlan.deleteMany(),
    Cart.deleteMany(),
    Order.deleteMany(),
  ]);

  // Demo accounts
  const admin = await User.create({
    name: 'FlavorNest Admin',
    email: process.env.ADMIN_EMAIL || 'admin@flavornest.com',
    password: 'admin123',
    role: 'admin',
  });

  const demoUser = await User.create({
    name: 'Anjali Demo',
    email: 'demo@flavornest.com',
    password: 'demo1234',
    role: 'user',
    favoriteCuisines: ['Indian', 'Japanese'],
  });

  // Insert recipes with computed nutrition + a randomized seed for views/favorites
  // so trending/rating sort has something interesting to show out of the box.
  const created = [];
  for (const data of recipesData) {
    const nutrition = estimateNutrition(data.ingredients, data.servings);
    const seedViews = Math.floor(Math.random() * 400) + 20;
    const seedFavorites = Math.floor(Math.random() * 40);
    const seedPrice = Math.round((Math.random() * 10 + 6.99) * 100) / 100; // $6.99–$16.99 kit price

    const recipe = new Recipe({
      ...data,
      nutrition,
      views: seedViews,
      favoritesCount: seedFavorites,
      price: seedPrice,
      isSeedRecipe: true,
      status: 'approved',
      createdBy: admin._id,
    });
    recipe.trendingScore = computeTrendingScore(recipe);
    await recipe.save();
    created.push(recipe);
  }

  // Seed a handful of reviews so avgRating isn't zero everywhere
  const sampleComments = [
    'Absolutely delicious, made this twice already!',
    'Great weeknight recipe, easy to follow.',
    'Restaurant quality at home - impressive.',
    'Solid recipe, tweaked the spice level to taste.',
    'A new family favorite.',
  ];
  for (const recipe of created.slice(0, 8)) {
    const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5
    await Review.create({
      recipe: recipe._id,
      user: demoUser._id,
      rating,
      comment: sampleComments[Math.floor(Math.random() * sampleComments.length)],
    });
    recipe.avgRating = rating;
    recipe.ratingsCount = 1;
    recipe.trendingScore = computeTrendingScore(recipe);
    await recipe.save();
  }

  // Give the demo user a couple of favorites and a starter meal plan
  demoUser.favorites = [created[0]._id, created[7]._id];
  await demoUser.save();
  created[0].favoritesCount += 1;
  created[7].favoritesCount += 1;
  await created[0].save();
  await created[7].save();

  await MealPlan.create({
    user: demoUser._id,
    entries: { monday: { recipe: created[0]._id }, wednesday: { recipe: created[4]._id } },
  });

  // Sample orders so the tracking UI has something to show out of the box
  const orderItems = (recipes) =>
    recipes.map((r) => ({ recipe: r._id, title: r.title, image: r.image, price: r.price, quantity: 1 }));

  const items1 = orderItems([created[0], created[2]]);
  const subtotal1 = Math.round(items1.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
  await Order.create({
    user: demoUser._id,
    items: items1,
    subtotal: subtotal1,
    deliveryFee: 2.99,
    tax: Math.round(subtotal1 * 0.05 * 100) / 100,
    total: Math.round((subtotal1 + 2.99 + subtotal1 * 0.05) * 100) / 100,
    currency: 'usd',
    deliveryAddress: { name: demoUser.name, line1: '221B Demo Street', city: 'Hyderabad', zip: '500001' },
    status: 'delivered',
    statusHistory: [
      { status: 'placed', at: new Date(Date.now() - 3 * 86400000) },
      { status: 'preparing', at: new Date(Date.now() - 3 * 86400000 + 3600000) },
      { status: 'out_for_delivery', at: new Date(Date.now() - 2 * 86400000) },
      { status: 'delivered', at: new Date(Date.now() - 2 * 86400000 + 5400000) },
    ],
    paymentStatus: 'paid',
    paymentIntentId: 'mock_pi_seed_1',
  });

  const items2 = orderItems([created[9]]);
  const subtotal2 = Math.round(items2.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
  await Order.create({
    user: demoUser._id,
    items: items2,
    subtotal: subtotal2,
    deliveryFee: 2.99,
    tax: Math.round(subtotal2 * 0.05 * 100) / 100,
    total: Math.round((subtotal2 + 2.99 + subtotal2 * 0.05) * 100) / 100,
    currency: 'usd',
    deliveryAddress: { name: demoUser.name, line1: '221B Demo Street', city: 'Hyderabad', zip: '500001' },
    status: 'out_for_delivery',
    statusHistory: [
      { status: 'placed', at: new Date(Date.now() - 3600000) },
      { status: 'preparing', at: new Date(Date.now() - 1800000) },
      { status: 'out_for_delivery', at: new Date() },
    ],
    paymentStatus: 'paid',
    paymentIntentId: 'mock_pi_seed_2',
  });

  console.log(`✅ Seeded ${created.length} recipes across ${new Set(created.map((r) => r.cuisine)).size} cuisines`);
  console.log(`✅ Admin login:  ${admin.email} / admin123`);
  console.log(`✅ Demo login:   ${demoUser.email} / demo1234`);

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Seed failed.');
  if (err.name === 'ValidationError') {
    console.error('   A document failed schema validation:');
    Object.values(err.errors).forEach((e) => console.error(`   - ${e.path}: ${e.message}`));
  } else if (err.code === 11000) {
    console.error(`   Duplicate key error on field: ${Object.keys(err.keyValue || {})[0]}`);
    console.error('   (This can happen if a previous seed run was interrupted - try again, it clears collections first.)');
  } else {
    console.error(`   ${err.message}`);
  }
  console.error('\n   Full error for reference:');
  console.error(err);
  process.exit(1);
});
