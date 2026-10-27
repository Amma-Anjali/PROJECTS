const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true // always store the bcrypt hash, never plain text
  },
  interests: {
    type: [String], // e.g. ["AI", "Technology", "Sports"]
    default: []
  },
  savedArticles: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Article',
    default: []
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

module.exports = mongoose.model('User', userSchema);
