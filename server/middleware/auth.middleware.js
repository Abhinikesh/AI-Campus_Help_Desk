const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies?.campus_token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, name }
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    return res.status(401).json({ success: false, message: 'Token invalid or expired. Please log in again.' });
  }
};

module.exports = authMiddleware;
