import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import config from '../config.js';
import File from '../models/File.js';

const router = Router();

// Ensure upload directory exists
const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
});

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4().split('-')[0];
    const fileMeta = await File.create({
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: { id: req.user.id, username: req.user.username },
      roomId: req.body.roomId || null,
      uploadedAt: new Date(),
    });
    console.log(`[DB] File saved successfully: ${fileMeta.originalName} (${fileId})`);

    res.status(201).json(fileMeta);
  } catch (err) {
    console.error('[DB Error] Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download file
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const fileMeta = await File.findOne({ id: req.params.id });
    if (!fileMeta) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(uploadDir, fileMeta.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File no longer exists' });
    }

    res.download(filePath, fileMeta.originalName);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// List files for a room
router.get('/room/:roomId', authenticateToken, async (req, res) => {
  try {
    const files = await File.find({ roomId: req.params.roomId });
    res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
