const Products = require("../../models/sales/Product");
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

// GET all Products (Famille)
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await Products.findAll({
        attributes: ["id_famille", "desig_famille"],
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      res.status(500).json({ message: "Error fetching Products" });
    }
  },
];

// CREATE new Product (Famille)
exports.create = [
  verifyToken,
  async (req, res) => {
    const { desig_famille } = req.body;

    if (!desig_famille) {
      return res.status(400).json({
        message: "'desig_famille' is required",
      });
    }

    try {
      await Products.create({ desig_famille });
      res.status(201).json({ message: "Product created successfully" });
    } catch (err) {
      console.error("Create Product Error:", err);
      res.status(500).json({ message: "Error creating Product" });
    }
  },
];

// UPDATE existing Product (Famille)
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_famille } = req.params;
    const { desig_famille } = req.body;

    if (!desig_famille) {
      return res.status(400).json({
        message: "'desig_famille' must be provided",
      });
    }

    try {
      const product = await Products.findByPk(id_famille);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      await product.update({ desig_famille });
      res.status(200).json({ message: "Product updated successfully" });
    } catch (err) {
      console.error("Update Product Error:", err);
      res.status(500).json({ message: "Error updating Product" });
    }
  },
];

// DELETE Product (Famille)
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_famille } = req.params;

    try {
      const product = await Products.findByPk(id_famille);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      await product.destroy();
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (err) {
      console.error("Delete Product Error:", err);
      res.status(500).json({ message: "Error deleting Product" });
    }
  },
];