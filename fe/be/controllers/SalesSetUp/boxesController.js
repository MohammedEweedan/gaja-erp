const Boxes = require("../../models/sales/Boxes");
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

// GET all Boxes (Famille)
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await Boxes.findAll({
        attributes: ["id_fact", "desig_art"],
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Boxes Error:", err);
      res.status(500).json({ message: "Error fetching Boxes" });
    }
  },
];

// CREATE new Boxe (Famille)
exports.create = [
  verifyToken,
  async (req, res) => {
    const { desig_art } = req.body;

    if (!desig_art) {
      return res.status(400).json({
        message: "'desig_art' is required",
      });
    }

    try {
      await Boxes.create({ desig_art });
      res.status(201).json({ message: "Boxe created successfully" });
    } catch (err) {
      console.error("Create Boxe Error:", err);
      res.status(500).json({ message: "Error creating Boxe" });
    }
  },
];

// UPDATE existing Boxe (Famille)
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_fact } = req.params;
    const { desig_art } = req.body;

    if (!desig_art) {
      return res.status(400).json({
        message: "'desig_art' must be provided",
      });
    }

    try {
      const Boxe = await Boxes.findByPk(id_fact);
      if (!Boxe) {
        return res.status(404).json({ message: "Boxe not found" });
      }

      await Boxe.update({ desig_art });
      res.status(200).json({ message: "Boxe updated successfully" });
    } catch (err) {
      console.error("Update Boxe Error:", err);
      res.status(500).json({ message: "Error updating Boxe" });
    }
  },
];

// DELETE Boxe (Famille)
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_fact } = req.params;

    try {
      const Boxe = await Boxes.findByPk(id_fact);
      if (!Boxe) {
        return res.status(404).json({ message: "Boxe not found" });
      }

      await Boxe.destroy();
      res.status(200).json({ message: "Boxe deleted successfully" });
    } catch (err) {
      console.error("Delete Boxe Error:", err);
      res.status(500).json({ message: "Error deleting Boxe" });
    }
  },
];