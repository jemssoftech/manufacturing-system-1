const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, AuditLog } = require('../models');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// 1. User login (OAuth2 password flow expects x-www-form-urlencoded with username and password)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password required' });
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ detail: 'Incorrect username or password' });
    }

    if (!user.is_active) {
      return res.status(400).json({ detail: 'Inactive user' });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Create access token
    const token = jwt.sign({ sub: user.user_id.toString() }, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    // Log action
    await AuditLog.create({
      user_id: user.user_id,
      action: 'login',
      entity_type: 'user',
      entity_id: user.user_id
    });

    // Response matches FastAPI Response Model Token
    return res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role_id: user.role_id,
        is_active: user.is_active
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. User Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, role_id } = req.body;

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ detail: 'Username already registered' });
    }

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ detail: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      username,
      email,
      password_hash,
      full_name,
      role_id
    });

    return res.status(201).json({
      user_id: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role_id: newUser.role_id,
      is_active: newUser.is_active
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. User profile
router.get('/profile', authenticateToken, async (req, res) => {
  return res.json({
    user_id: req.user.user_id,
    username: req.user.username,
    email: req.user.email,
    full_name: req.user.full_name,
    role_id: req.user.role_id,
    is_active: req.user.is_active
  });
});

// 4. List all users (admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;

    const users = await User.findAll({
      limit,
      offset,
      attributes: ['user_id', 'username', 'email', 'full_name', 'role_id', 'is_active']
    });

    return res.json(users);
  } catch (error) {
    console.error('List Users Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
