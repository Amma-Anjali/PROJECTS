const mongoose = require('mongoose');

const ORDER_STATUSES = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    // Snapshot fields so past orders stay accurate even if the recipe is later edited/deleted
    title: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: 'usd' },

    deliveryAddress: {
      name: String,
      phone: String,
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: String,
      zip: String,
    },

    status: { type: String, enum: ORDER_STATUSES, default: 'placed' },
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        at: { type: Date, default: Date.now },
      },
    ],

    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentIntentId: { type: String, default: null },
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
