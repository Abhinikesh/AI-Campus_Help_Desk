const express = require('express');
const router = express.Router();
const {
  upload, getFiles, uploadFile,
  downloadFile, shareFile, getSharedFile, deleteFile
} = require('../controllers/drive.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public route - shared file download (no auth)
router.get('/shared/:code', getSharedFile);

// Protected routes
router.get('/', authMiddleware, getFiles);
router.post('/upload',
  authMiddleware,
  upload.single('file'),
  uploadFile
);
router.get('/download/:id', authMiddleware, downloadFile);
router.get('/share/:id', authMiddleware, shareFile);
router.delete('/:id', authMiddleware, deleteFile);

module.exports = router;
