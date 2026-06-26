const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Drive = require('../models/Drive');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/drive');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx',
                   '.xls', '.xlsx', '.zip', '.txt', '.jpg',
                   '.png', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET all files (with optional category filter)
const getFiles = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    const files = await Drive.find(query)
      .sort({ createdAt: -1 });
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST upload file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    const { subject, category, semester, description } = req.body;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    const typeMap = {
      '.pdf': 'PDF', '.doc': 'DOC', '.docx': 'DOC',
      '.ppt': 'PPT', '.pptx': 'PPT', '.xls': 'XLS',
      '.xlsx': 'XLS', '.zip': 'ZIP', '.txt': 'TXT',
      '.jpg': 'IMG', '.jpeg': 'IMG', '.png': 'IMG'
    };

    const file = await Drive.create({
      name: req.file.originalname,
      filename: req.file.filename,
      subject: subject || 'General',
      category: category || 'notes',
      semester: semester || 'Sem 4',
      description: description || '',
      size: req.file.size,
      type: typeMap[ext] || 'FILE',
      uploadedBy: req.user.userId,
      uploaderName: req.user.name,
      uploaderRole: req.user.role,
      path: req.file.path,
      shareCode: Math.random().toString(36).substring(2, 8).toUpperCase()
    });

    res.json({ success: true, file });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET download file
const downloadFile = async (req, res) => {
  try {
    const file = await Drive.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Increment download count
    await Drive.findByIdAndUpdate(req.params.id, {
      $inc: { downloads: 1 }
    });

    const filePath = path.join(
      __dirname, '../uploads/drive', file.filename
    );
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    res.download(filePath, file.name);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET share link
const shareFile = async (req, res) => {
  try {
    const file = await Drive.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    const shareLink = `${req.protocol}://${req.get('host')}/api/drive/shared/${file.shareCode}`;
    res.json({ success: true, shareLink, shareCode: file.shareCode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET file by share code (public - no auth needed)
const getSharedFile = async (req, res) => {
  try {
    const file = await Drive.findOne({
      shareCode: req.params.code
    });
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'Shared file not found'
      });
    }
    const filePath = path.join(
      __dirname, '../uploads/drive', file.filename
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }
    await Drive.findByIdAndUpdate(file._id, {
      $inc: { downloads: 1 }
    });
    res.download(filePath, file.name);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE file
const deleteFile = async (req, res) => {
  try {
    const file = await Drive.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    // Only uploader or admin can delete
    if (file.uploadedBy.toString() !== req.user.userId &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this file'
      });
    }
    // Delete physical file
    const filePath = path.join(
      __dirname, '../uploads/drive', file.filename
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await Drive.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  upload,
  getFiles,
  uploadFile,
  downloadFile,
  shareFile,
  getSharedFile,
  deleteFile
};
