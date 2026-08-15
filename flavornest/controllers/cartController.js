const Cart = require('../models/Cart');
const Recipe = require('../models/Recipe');

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

function summarize(cart, recipeMap) {
  const items = cart.items.map((item) => {
    const recipe = recipeMap.get(String(item.recipe));
    return {
      recipe: recipe
        ? { _id: recipe._id, title: recipe.title, image: recipe.image, price: recipe.price, cuisine: recipe.cuisine }
        : null,
      quantity: item.quantity,
      lineTotal: recipe ? Math.round(recipe.price * item.quantity * 100) / 100 : 0,
    };
  });
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  return { items, subtotal, count: items.reduce((n, i) => n + i.quantity, 0) };
}

async function buildResponse(cart) {
  const ids = cart.items.map((i) => i.recipe);
  const recipes = await Recipe.find({ _id: { $in: ids } });
  const recipeMap = new Map(recipes.map((r) => [String(r._id), r]));
  return summarize(cart, recipeMap);
}

// GET /api/cart
async function getCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    res.json({ success: true, ...(await buildResponse(cart)) });
  } catch (err) {
    next(err);
  }
}

// POST /api/cart/items - { recipeId, quantity } — quantity <= 0 removes the item
async function upsertItem(req, res, next) {
  try {
    const { recipeId, quantity = 1 } = req.body;
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const cart = await getOrCreateCart(req.user._id);
    const idx = cart.items.findIndex((i) => String(i.recipe) === String(recipeId));

    if (Number(quantity) <= 0) {
      if (idx !== -1) cart.items.splice(idx, 1);
    } else if (idx !== -1) {
      cart.items[idx].quantity = Number(quantity);
    } else {
      cart.items.push({ recipe: recipeId, quantity: Number(quantity) });
    }

    await cart.save();
    res.json({ success: true, ...(await buildResponse(cart)) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart/items/:recipeId
async function removeItem(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    cart.items = cart.items.filter((i) => String(i.recipe) !== String(req.params.recipeId));
    await cart.save();
    res.json({ success: true, ...(await buildResponse(cart)) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart - clear entirely
async function clearCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    cart.items = [];
    await cart.save();
    res.json({ success: true, items: [], subtotal: 0, count: 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, upsertItem, removeItem, clearCart };
