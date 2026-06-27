const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let dbUri = process.env.MONGODB_URI;
    let isMemoryDb = false;

    if (!dbUri) {
      console.log('⚠️ MONGODB_URI not found in environment variables. Attempting to start in-memory MongoDB...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        dbUri = mongod.getUri();
        isMemoryDb = true;
        console.log(`ℹ️ In-memory MongoDB started at: ${dbUri}`);
      } catch (memError) {
        console.error('❌ Failed to start in-memory MongoDB server:', memError.message);
        throw new Error('No database URI provided and in-memory server failed to start.');
      }
    }

    const conn = await mongoose.connect(dbUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Auto-seed if the database is empty (no users exist)
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Database is empty. Running auto-seeding...');
      const seedFunc = require('../seed');
      await seedFunc();
      console.log('🌱 Auto-seeding completed successfully!');
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
