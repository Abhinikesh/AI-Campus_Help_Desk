const express = require('express');
const router = express.Router();
const {
  getStats, getAllUsers, getAllComplaints,
  updateComplaintStatus, createAnnouncement, deactivateUser
} = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All admin routes require auth + admin role
router.use(authMiddleware, allowRoles('admin'));

router.get('/stats',                        getStats);
router.get('/users',                        getAllUsers);
router.delete('/users/:id',                 deactivateUser);
router.get('/complaints',                   getAllComplaints);
router.patch('/complaints/:id/status',      updateComplaintStatus);
router.post('/announcements',               createAnnouncement);

module.exports = router;
