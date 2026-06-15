const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

/**
 * Middleware to authenticate requests using JWT tokens
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    // Handle both "Bearer <token>" format and direct token
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) {
      return res.status(401).json({ detail: 'Authentication token missing or invalid' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ detail: 'Invalid token payload' });
    }

    const user = await User.findByPk(parseInt(decoded.sub), {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(400).json({ detail: 'Inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }
}

/**
 * Middleware to authorize requests based on user role
 * @param {string} requiredRole - The role needed to access the route
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
    const roleName = req.user.role ? req.user.role.role_name : '';
    if (roleName !== requiredRole && roleName !== 'admin') {
      return res.status(403).json({ detail: `Access denied. Required role: ${requiredRole}` });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
