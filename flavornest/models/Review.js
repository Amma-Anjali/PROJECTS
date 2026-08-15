const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 800, default: '' },
  },
  { timestamps: true }
);

// One review per user per recipe
reviewSchema.index({ recipe: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
