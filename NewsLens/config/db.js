const mongoose = require('mongoose');

// Connects to MongoDB using the URI from .env.
// Kept as its own small function so app.js stays readable.
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // No point running the server without a database
  }
}

module.exports = connectDB;
