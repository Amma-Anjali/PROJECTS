const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Preferences power personalized recommendations
    dietaryPreferences: [{ type: String, trim: true }], // e.g. ['vegetarian', 'gluten-free']
    favoriteCuisines: [{ type: String, trim: true }],

    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }],

    // Lightweight interaction history used by the recommendation engine
    viewedRecipes: [
      {
        recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Generates a reset token, stores its hash (never the raw token) + a 30-min
// expiry, and returns the raw token to email to the user.
userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  return rawToken;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    dietaryPreferences: this.dietaryPreferences,
    favoriteCuisines: this.favoriteCuisines,
    favorites: this.favorites,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
