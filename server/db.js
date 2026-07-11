import mongoose from 'mongoose';
import config from './config.js';

export const connectDB = async () => {
  try {
    if (!config.mongoUri) {
      console.warn('⚠️ MONGODB_URI is not set in environment variables. Database connection skipped. Some features may not work.');
      return;
    }
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
