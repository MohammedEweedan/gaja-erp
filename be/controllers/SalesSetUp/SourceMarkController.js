const SourceMark = require("../../models/sales/SourceMark");
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

// GET all Source Marks
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await SourceMark.findAll({
        attributes: ["id_SourceMark", "SourceMarketing", "Status"],
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch SourceMark Error:", err);
      res.status(500).json({ message: "Error fetching Source Marks" });
    }
  },
];

// CREATE new Source Mark
exports.create = [
  verifyToken,
  async (req, res) => {
    const { SourceMarketing, Status } = req.body;

    if (!SourceMarketing || Status === undefined) {
      return res.status(400).json({
        message: "Both 'SourceMarketing' and 'Status' are required",
      });
    }

    try {
      await SourceMark.create({ SourceMarketing, Status });
      res.status(201).json({ message: "Source Mark created successfully" });
    } catch (err) {
      console.error("Create SourceMark Error:", err);
      res.status(500).json({ message: "Error creating Source Mark" });
    }
  },
];

// UPDATE existing Source Mark
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_SourceMark } = req.params;
    const { SourceMarketing, Status } = req.body;

    if (!SourceMarketing && Status === undefined) {
      return res.status(400).json({
        message: "At least one field (SourceMarketing or Status) must be provided",
      });
    }

    try {
      const sourceMark = await SourceMark.findByPk(id_SourceMark);
      if (!sourceMark) {
        return res.status(404).json({ message: "Source Mark not found" });
      }

      await sourceMark.update({ 
        ...(SourceMarketing && { SourceMarketing }), 
        ...(Status !== undefined && { Status }) 
      });

      res.status(200).json({ message: "Source Mark updated successfully" });
    } catch (err) {
      console.error("Update SourceMark Error:", err);
      res.status(500).json({ message: "Error updating Source Mark" });
    }
  },
];

// DELETE Source Mark
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_SourceMark } = req.params;

    try {
      const sourceMark = await SourceMark.findByPk(id_SourceMark);
      if (!sourceMark) {
        return res.status(404).json({ message: "Source Mark not found" });
      }

      await sourceMark.destroy();
      res.status(200).json({ message: "Source Mark deleted successfully" });
    } catch (err) {
      console.error("Delete SourceMark Error:", err);
      res.status(500).json({ message: "Error deleting Source Mark" });
    }
  },
];