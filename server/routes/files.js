import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import config from '../config.js';

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

// In-memory file metadata store
const fileStore = new Map();

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4().split('-')[0];
    const fileMeta = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: { id: req.user.id, username: req.user.username },
      roomId: req.body.roomId || null,
      uploadedAt: new Date().toISOString(),
    };

    fileStore.set(fileId, fileMeta);
    res.status(201).json(fileMeta);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download file
router.get('/:id', authenticateToken, (req, res) => {
  const fileMeta = fileStore.get(req.params.id);
  if (!fileMeta) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(uploadDir, fileMeta.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File no longer exists' });
  }

  res.download(filePath, fileMeta.originalName);
});

// List files for a room
router.get('/room/:roomId', authenticateToken, (req, res) => {
  const files = [];
  for (const [, file] of fileStore) {
    if (file.roomId === req.params.roomId) {
      files.push(file);
    }
  }
  res.json(files);
});

export default router;
