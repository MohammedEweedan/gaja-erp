const ItemsPicture = require("../../models/sales/Pic");
const jwt = require("jsonwebtoken");

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};

// GET all images
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const pictures = await ItemsPicture.findAll();
      res.status(200).json(pictures);
    } catch (err) {
      console.error("Fetch ItemsPicture Error:", err);
      res.status(500).json({ message: "Error fetching pictures" });
    }
  },
];

// GET image by ID
exports.findById = [
  verifyToken,
  async (req, res) => {

    try {

     
      const picture = await ItemsPicture.findOne({ where: { id_art: req.params.id_art } }); if (!picture) {
        return res.status(404).json({ message: "Image not found" });
      }

      res.status(200).json(picture);
    } catch (err) {
      console.error("Fetch Image by ID Error:", err);
      res.status(500).json({ message: "Error fetching image" });
    }
  },
];
