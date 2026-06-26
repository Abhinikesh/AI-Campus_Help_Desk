const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// Optionally require auth middleware
// const { protect } = require('../middleware/authMiddleware');

router.post('/chat', aiController.chat);

module.exports = router;
