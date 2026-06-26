const express = require('express');
const router = express.Router();
const { getStudentData } = require('../controllers/parent.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// All parent routes require auth + parent role
router.use(authMiddleware, allowRoles('parent'));

router.get('/student-data', getStudentData);

module.exports = router;
