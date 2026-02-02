const Points = require("../../models/sales/ps"); // Adjust model name/path
const jwt = require("jsonwebtoken");

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded;
    next();
  });
};

// Find all points
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await Points.findAll({
        attributes: ['Id_point', 'name_point', 'Email']
      });
      res.json(data);
    } catch (err) {
      console.error("Fetch Points Error:", err);
      res.status(500).json({ message: "Error fetching Points" });
    }
  }
];

// Create a new point
exports.create = [
  verifyToken,
  async (req, res) => {
    const { name_point, Email } = req.body;

    if (!name_point || !Email) {
      return res.status(400).json({ message: "name_point and Email are required" });
    }

    try {
      await Points.create({ name_point, Email });
      res.status(201).json({ message: "Point created successfully" });
    } catch (err) {
      console.error("Create Point Error:", err);
      res.status(500).json({ message: "Error creating Point" });
    }
  }
];

// Update a point by ID
exports.update = [
  verifyToken,
  async (req, res) => {
    const { Id_point } = req.params;
    const { name_point, Email } = req.body;

    try {
      const point = await Points.findByPk(Id_point);
      if (!point) return res.status(404).json({ message: "Point not found" });

      await point.update({ name_point, Email });
      res.status(200).json({ message: "Point updated successfully" });
    } catch (err) {
      console.error("Update Point Error:", err);
      res.status(500).json({ message: "Error updating Point" });
    }
  }
];

// Delete a point by ID
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { Id_point } = req.params;

    try {
      const point = await Points.findByPk(Id_point);
      if (!point) return res.status(404).json({ message: "Point not found" });

      await point.destroy();
      res.status(200).json({ message: "Point deleted successfully" });
    } catch (err) {
      console.error("Delete Point Error:", err);
      res.status(500).json({ message: "Error deleting Point" });
    }
  }
];
