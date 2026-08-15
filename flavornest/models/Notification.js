const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['order_status', 'recipe_approved', 'recipe_rejected', 'new_review', 'new_order_admin', 'recipe_pending_admin', 'general'],
      default: 'general',
    },
    message: { type: String, required: true },
    link: { type: String, default: '' }, // e.g. "/orders.html" for the frontend to navigate to
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
