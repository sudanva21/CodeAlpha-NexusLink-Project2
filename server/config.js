import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_me',
  corsOrigins: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true,
  upload: {
    maxSize: 50 * 1024 * 1024, // 50MB
    dir: './server/uploads',
  },
  ice: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};
