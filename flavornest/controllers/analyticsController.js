const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Review = require('../models/Review');
const Order = require('../models/Order');

// GET /api/analytics/trending - public, top trending recipes right now
async function trending(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const recipes = await Recipe.find({ status: 'approved' }).sort({ trendingScore: -1 }).limit(limit);
    res.json({ success: true, recipes });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/overview - admin dashboard
async function overview(req, res, next) {
  try {
    const [
      totalRecipes,
      totalUsers,
      totalReviews,
      byCuisine,
      topRecipes,
      topReviewed,
      orderStats,
      bestSellers,
    ] = await Promise.all([
      Recipe.countDocuments({ status: 'approved' }),
      User.countDocuments(),
      Review.countDocuments(),
      Recipe.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$cuisine', count: { $sum: 1 }, avgRating: { $avg: '$avgRating' } } },
        { $sort: { count: -1 } },
      ]),
      Recipe.find({ status: 'approved' }).sort({ views: -1 }).limit(5).select('title views favoritesCount cuisine'),
      Recipe.find({ status: 'approved', ratingsCount: { $gt: 0 } })
        .sort({ avgRating: -1 })
        .limit(5)
        .select('title avgRating ratingsCount cuisine'),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$total' }, orderCount: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $unwind: '$items' },
        { $group: { _id: '$items.title', qty: { $sum: '$items.quantity' } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      success: true,
      totals: { recipes: totalRecipes, users: totalUsers, reviews: totalReviews },
      byCuisine,
      topViewed: topRecipes,
      topRated: topReviewed,
      revenue: {
        total: orderStats[0]?.totalRevenue || 0,
        paidOrders: orderStats[0]?.orderCount || 0,
      },
      bestSellers,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { trending, overview };
