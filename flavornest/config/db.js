const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flavornest';

  mongoose.set('strictQuery', true);

  try {
    // Fail fast (5s) instead of mongoose's 30s default, so a down/misconfigured
    // database shows up as a clear error quickly instead of a long, silent hang.
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('\n❌ Could not connect to MongoDB.');
    console.error(`   Tried: ${uri}`);
    console.error(`   Reason: ${err.message}\n`);
    console.error('   Most likely fix - MongoDB isn\'t running. Start it with:');
    console.error('     macOS (Homebrew):  brew services start mongodb-community');
    console.error('     Linux (systemd):   sudo systemctl start mongod');
    console.error('     Windows:            net start MongoDB');
    console.error('     Or run `mongod` directly in another terminal.\n');
    console.error('   Using MongoDB Atlas instead? Check that MONGO_URI in .env is the');
    console.error('   correct connection string and your current IP is allowlisted.\n');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

module.exports = connectDB;
