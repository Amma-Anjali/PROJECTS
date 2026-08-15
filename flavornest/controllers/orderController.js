const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const { createPaymentIntent, retrievePaymentIntent, useMock, publishableKey } = require('../utils/payment');
const { streamInvoice } = require('../utils/invoice');
const { notifyUser, notifyAdmins } = require('../utils/notify');
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../utils/email');
const { getIO } = require('../config/socket');

const CURRENCY = process.env.CURRENCY || 'usd';
const TAX_RATE = Number(process.env.TAX_RATE) || 0.05;
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE) || 2.99;
const FREE_DELIVERY_THRESHOLD = Number(process.env.FREE_DELIVERY_THRESHOLD) || 25;

// GET /api/orders/config - publishable key + mock-mode flag, so the frontend knows how to render checkout
function getConfig(req, res) {
  res.json({ success: true, publishableKey, mock: useMock, currency: CURRENCY });
}

// POST /api/orders/checkout - builds an order from the current cart and creates a PaymentIntent
async function checkout(req, res, next) {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    const recipes = await Recipe.find({ _id: { $in: cart.items.map((i) => i.recipe) } });
    const recipeMap = new Map(recipes.map((r) => [String(r._id), r]));

    const items = cart.items
      .map((i) => {
        const r = recipeMap.get(String(i.recipe));
        if (!r) return null;
        return { recipe: r._id, title: r.title, image: r.image, price: r.price, quantity: i.quantity };
      })
      .filter(Boolean);

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are no longer available' });
    }

    const subtotal = Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
    const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

    const paymentIntent = await createPaymentIntent({
      amount: Math.round(total * 100),
      currency: CURRENCY,
      metadata: { userId: String(req.user._id) },
    });

    const order = await Order.create({
      user: req.user._id,
      items,
      subtotal,
      deliveryFee,
      tax,
      total,
      currency: CURRENCY,
      deliveryAddress: req.body.deliveryAddress,
      status: 'placed',
      statusHistory: [{ status: 'placed' }],
      paymentStatus: 'pending',
      paymentIntentId: paymentIntent.id,
    });

    // Cart is cleared once the order is placed (order exists whether or not payment later fails)
    cart.items = [];
    await cart.save();

    notifyAdmins('order:new', { orderId: order._id, total: order.total, userName: req.user.name });

    res.status(201).json({
      success: true,
      order,
      clientSecret: paymentIntent.client_secret,
      mock: useMock,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders/:id/confirm-payment - call after Stripe.js confirms the PaymentIntent client-side
// (in mock mode this immediately marks the order paid)
async function confirmPayment(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const intent = await retrievePaymentIntent(order.paymentIntentId);
    order.paymentStatus = intent.status === 'succeeded' ? 'paid' : 'failed';
    await order.save();

    if (order.paymentStatus === 'paid') {
      notifyUser(req.user._id, {
        type: 'order_status',
        message: `Order #${String(order._id).slice(-8).toUpperCase()} confirmed - $${order.total.toFixed(2)}`,
        link: '/orders.html',
      }).catch((err) => console.error('Notification failed:', err.message));

      sendOrderConfirmationEmail(req.user, order).catch((err) => console.error('Order email failed:', err.message));
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders - the logged-in user's own orders
async function listMine(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/admin/all (admin) - every order, optionally filtered by status
async function listAll(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id - single order (owner or admin)
async function getOne(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

// PUT /api/orders/:id/status (admin) - advance the order through its tracking timeline
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!Order.STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${Order.STATUSES.join(', ')}` });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    order.statusHistory.push({ status });
    await order.save();

    const io = getIO();
    if (io) io.to(`user:${order.user}`).emit('order:status', { orderId: order._id, status: order.status });

    notifyUser(order.user, {
      type: 'order_status',
      message: `Order #${String(order._id).slice(-8).toUpperCase()} is now ${status.replace(/_/g, ' ')}`,
      link: '/orders.html',
    }).catch((err) => console.error('Notification failed:', err.message));

    User.findById(order.user)
      .then((user) => user && sendOrderStatusEmail(user, order))
      .catch((err) => console.error('Status email failed:', err.message));

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id/invoice - PDF invoice (owner or admin)
async function getInvoice(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(order.user);
    streamInvoice(order, user, res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConfig,
  checkout,
  confirmPayment,
  listMine,
  listAll,
  getOne,
  updateStatus,
  getInvoice,
};
