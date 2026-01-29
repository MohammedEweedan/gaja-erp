const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const doPurchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id_achat = req.body.id_achat || req.query.id_achat || req.params.id_achat;
    const baseDir = path.join(__dirname, "uploads", "DOpurchase", "upload-attachment");
    const targetDir = id_achat ? path.join(baseDir, String(id_achat)) : path.join(baseDir, "_unknown");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const doPurchaseUpload = multer({ storage: doPurchaseStorage });

function requireBearer(req, res) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader || !String(authHeader).startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return null;
  }
  return String(authHeader).split(" ")[1];
}

module.exports = function (app) {
  app.options("/uploads/DOpurchase/upload-attachment/:id_achat", cors());

  app.post(
    "/uploads/DOpurchase/upload-attachment/:id_achat",
    cors(),
    doPurchaseUpload.array("files", 10),
    async (req, res) => {
      if (!requireBearer(req, res)) return;

      const id_achat = req.params.id_achat || req.body.id_achat || req.query.id_achat;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      if (!id_achat) {
        return res.status(400).json({ error: "No purchase ID provided" });
      }

      const fileUrls = req.files.map(
        (file) =>
          `${req.protocol}://${req.get("host")}/uploads/DOpurchase/upload-attachment/${id_achat}/${file.filename}`
      );

      res.json({ links: fileUrls });
    }
  );

  app.get("/uploads/DOpurchase/upload-attachment/:id_achat", cors(), (req, res) => {
    if (!requireBearer(req, res)) return;

    const id_achat = req.params.id_achat;
    if (!id_achat) {
      return res.status(400).json({ error: "No purchase ID provided" });
    }

    const dir = path.join(__dirname, "uploads", "DOpurchase", "upload-attachment", String(id_achat));
    if (!fs.existsSync(dir)) {
      return res.json({ files: [] });
    }

    fs.readdir(dir, (err, files) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read files" });
      }
      const fileUrls = files.map(
        (file) => `${req.protocol}://${req.get("host")}/uploads/DOpurchase/upload-attachment/${id_achat}/${file}`
      );
      res.json({ files: fileUrls });
    });
  });

  app.use("/uploads/DOpurchase/upload-attachment/:id_achat/", (req, res, next) => {
    if (!req.path.match(/\.[a-zA-Z0-9]+$/)) {
      return res.status(403).send("Forbidden");
    }
    next();
  });

  app.delete("/uploads/DOpurchase/upload-attachment/:id_achat/:filename", cors(), (req, res) => {
    if (!requireBearer(req, res)) return;

    const { id_achat, filename } = req.params;
    if (!id_achat || !filename) {
      return res.status(400).json({ error: "Missing purchase ID or filename" });
    }

    const filePath = path.join(
      __dirname,
      "uploads",
      "DOpurchase",
      "upload-attachment",
      String(id_achat),
      filename
    );

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
