const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require('cors');

// Multer storage for WOpurchases: folder per id_achat in uploads/WOpurchase
const woPurchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let id_achat = req.body.id_achat || req.query.id_achat || req.params.id_achat;
    const baseDir = path.join(__dirname, "uploads", "WOpurchase", "upload-attachment");
    let targetDir;

    console.log("ID Achat:", id_achat);
    if (!id_achat) {
      targetDir = path.join(baseDir, '_unknown');
    } else {
      targetDir = path.join(baseDir, String(id_achat));
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const woPurchaseUpload = multer({ storage: woPurchaseStorage });

module.exports = function(app) {
 
  app.post("/uploads/WOpurchase/upload-attachment/:id_achat", cors(), woPurchaseUpload.array("files", 10), async (req, res) => {
    // Token check
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    // Optionally: verify token here if you want to reject invalid tokens
    // Example: jwt.verify(token, secret)

    const id_achat = req.params.id_achat || req.body.id_achat || req.query.id_achat;

    console.log("Received ID Achat:", id_achat);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    if (!id_achat) {
      return res.status(400).json({ error: "No purchase ID provided" });
    }
    // Folder creation is handled by multer storage, no need to do it here
    const fileUrls = req.files.map(file => `${req.protocol}://${req.get("host")}/uploads/WOpurchase/upload-attachment/${id_achat}/${file.filename}`);
    try {
      res.json({ links: fileUrls });
    } catch (err) {
      // console.error("Upload error:", err);
      // res.status(500).json({ error: "Failed to update watch purchase with attachments", details: err.message });
    }
  });
  
  // List all files for a given id_achat
  app.options('/uploads/WOpurchase/upload-attachment/:id_achat', cors());
  app.get("/uploads/WOpurchase/upload-attachment/:id_achat", cors(), (req, res) => {
    // Token check
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    // Optionally: verify token here if you want to reject invalid tokens
    // Example: jwt.verify(token, secret)

    const id_achat = req.params.id_achat;
    if (!id_achat) {
        return res.status(400).json({ error: "No purchase ID provided" });
    }
    const dir = path.join(__dirname, "uploads", "WOpurchase", "upload-attachment", String(id_achat));
    if (!fs.existsSync(dir)) {
        return res.json({ files: [] });
    }
    fs.readdir(dir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Failed to read files" });
        }
        const fileUrls = files.map(file => `${req.protocol}://${req.get("host")}/uploads/WOpurchase/upload-attachment/${id_achat}/${file}`);
        res.json({ files: fileUrls });
    });
});

  // Prevent directory listing for /uploads/WOpurchase/upload-attachment/:id_achat/
  app.use('/uploads/WOpurchase/upload-attachment/:id_achat/', (req, res, next) => {
    // If the request is for a directory (no file extension), block it
    if (!req.path.match(/\.[a-zA-Z0-9]+$/)) {
      return res.status(403).send('Forbidden');
    }
    next();
  });

  // Delete a specific file for a given id_achat
  app.delete("/uploads/WOpurchase/upload-attachment/:id_achat/:filename", cors(), (req, res) => {
    // Token check
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    // Optionally: verify token here if you want to reject invalid tokens
    // Example: jwt.verify(token, secret)

    const id_achat = req.params.id_achat;
    const filename = req.params.filename;
    if (!id_achat || !filename) {
      return res.status(400).json({ error: "Missing purchase ID or filename" });
    }
    const filePath = path.join(__dirname, "uploads", "WOpurchase", "upload-attachment", String(id_achat), filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to delete file" });
      }
      res.json({ success: true, message: "File deleted" });
    });
  });
};
