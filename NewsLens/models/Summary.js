const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    unique: true // one cached summary per article
  },
  summary: { type: String, required: true },
  keyPoints: { type: [String], default: [] }
}, { timestamps: true }); // createdAt + updatedAt, since summaries can be regenerated later

module.exports = mongoose.model('Summary', summarySchema);
