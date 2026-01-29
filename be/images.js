const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to check token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Multer storage config for WatchPic/{id_achat}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const id_achat = req.body.id_achat || req.params.id_achat;
    if (!id_achat) return cb(new Error('No id_achat provided'));
    const baseDir = path.join(__dirname, '/uploads/WatchPic');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const dir = path.join(baseDir, String(id_achat));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Upload image endpoint
router.post('/upload/:id_achat', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const id_achat = req.params.id_achat;
  const fileUrl = `${req.protocol}://${req.get('host')}/images/${id_achat}/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// List images for a purchase
router.get('/list/:id_achat', authenticateToken, (req, res) => {
  try {
    const id_achat = req.params.id_achat;
    const dir = path.join(__dirname, '/uploads/WatchPic', String(id_achat));
    if (!fs.existsSync(dir)) return res.json([]);
    let files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
    // Limit to first 50 files, sorted by name (or change to sort by mtime if needed)
    files = files.sort().slice(0, 50);
    const urls = files.map(f => `${req.protocol}://${req.get('host')}/images/${id_achat}/${f}`);
    res.json(urls);
  } catch (err) {
    console.error('Error listing images:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Serve images securely (token can be passed as query param or header)
router.get('/:id_achat/:filename', (req, res) => {
  const { id_achat, filename } = req.params;
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }
  // Try to get token from header or query param
  let token = null;
  if (req.headers['authorization']) {
    token = req.headers['authorization'].split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).send('Unauthorized');
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).send('Forbidden');
    const filePath = path.join(__dirname, '/uploads/WatchPic', String(id_achat), filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    // Set security headers
    res.setHeader('Content-Type', 'image/jpeg'); // or use mime-types package for dynamic type
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(filePath);
  });
});

// Delete image endpoint
router.delete('/delete/:id_achat/:filename', authenticateToken, (req, res) => {
  const { id_achat, filename } = req.params;
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(__dirname, '/uploads/WatchPic', String(id_achat), filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
