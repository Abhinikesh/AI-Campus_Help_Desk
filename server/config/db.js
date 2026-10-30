/**
 * server/config/db.js
 * Connects to MongoDB.
 *   - Production: MONGODB_URI is required (validated in config/env.js).
 *   - Development: if MONGODB_URI is empty, starts mongodb-memory-server with a
 *     persistent dbPath (server/.data/db) on a fixed port (27018) so data
 *     survives restarts.
 */
'use strict';

const path = require('path');
const mongoose = require('mongoose');
const { MONGODB_URI, NODE_ENV } = require('./env');

const connectDB = async () => {
  let uri = MONGODB_URI;

  if (!uri) {
    if (NODE_ENV === 'production') {
      console.error('❌  MONGODB_URI is required in production. Exiting.');
      process.exit(1);
    }

    // Lazy-require so the package is only loaded in development
    const { MongoMemoryServer } = require('mongodb-memory-server'); // eslint-disable-line
    const dbPath = path.resolve(__dirname, '../.data/db');

    // Ensure persistent directory exists
    const fs = require('fs');
    fs.mkdirSync(dbPath, { recursive: true });

    try {
      const mongod = await MongoMemoryServer.create({
        instance: {
          port: 27018,
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      uri = mongod.getUri();
      console.log(`⚠️  No MONGODB_URI set — using persistent in-memory server at ${uri}`);
      console.log(`   Data stored in: ${dbPath}`);
    } catch (memErr) {
      if (memErr.message && (memErr.message.includes('already in use') || memErr.message.includes('27018'))) {
        uri = 'mongodb://127.0.0.1:27018/campus-erp';
        console.log(`⚠️  Reusing already running MongoDB server on port 27018`);
      } else {
        throw memErr;
      }
    }
  }

  try {
    const conn = await mongoose.connect(uri);
    const dbName = conn.connection.db.databaseName;
    console.log(`✅  MongoDB connected — database: "${dbName}" on ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
