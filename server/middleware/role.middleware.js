/**
 * allowRoles(...roles)
 * Usage: router.get('/path', authMiddleware, allowRoles('admin', 'faculty'), controller)
 * Must be used AFTER authMiddleware (req.user must exist)
 */
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for your role',
      });
    }

    next();
  };
};

module.exports = { allowRoles };
