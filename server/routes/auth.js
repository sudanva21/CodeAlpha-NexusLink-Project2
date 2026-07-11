import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { authenticateToken } from '../middleware/auth.js';

import User from '../models/User.js';

const router = Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

function generateAvatar(username) {
  const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
  const color = colors[username.length % colors.length];
  const initials = username.slice(0, 2).toUpperCase();
  return { color, initials };
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const avatar = generateAvatar(username);

    const user = await User.create({
      id,
      username,
      email,
      password: hashedPassword,
      avatar,
    });
    console.log(`[DB] User created successfully: ${username} (${id})`);

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: { id, username, email, avatar },
    });
  } catch (err) {
    console.error('[DB Error] Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const foundUser = await User.findOne({ email });

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, foundUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(foundUser);
    res.json({
      token,
      user: { id: foundUser.id, username: foundUser.username, email: foundUser.email, avatar: foundUser.avatar },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
