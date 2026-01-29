const ItemsTypes = require("../../models/sales/ItemsTypes");
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

// GET all Item Types
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await ItemsTypes.findAll({
        attributes: ["id_unite", "desig_unit", "Main_Name"], // Include Main_Name if needed
      });
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch ItemsTypes Error:", err);
      res.status(500).json({ message: "Error fetching Item Types" });
    }
  },
];

// CREATE new Item Type
exports.create = [
  verifyToken,
  async (req, res) => {
    const { desig_unit, Main_Name } = req.body;

    if (!desig_unit || !Main_Name) {
      return res.status(400).json({
        message: "Both 'desig_unit' and 'Main_Name' are required",
      });
    }

    try {
      await ItemsTypes.create({ desig_unit, Main_Name });
      res.status(201).json({ message: "Item Type created successfully" });
    } catch (err) {
      console.error("Create ItemType Error:", err);
      res.status(500).json({ message: "Error creating Item Type" });
    }
  },
];

// UPDATE existing Item Type
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_unite } = req.params;
    const { desig_unit, Main_Name } = req.body;

    if (!desig_unit && !Main_Name) {
      return res.status(400).json({
        message: "At least one field (desig_unit or Main_Name) must be provided",
      });
    }

    try {
      const itemType = await ItemsTypes.findByPk(id_unite);
      if (!itemType) {
        return res.status(404).json({ message: "Item Type not found" });
      }

      await itemType.update({ 
        ...(desig_unit && { desig_unit }), 
        ...(Main_Name && { Main_Name }) 
      });

      res.status(200).json({ message: "Item Type updated successfully" });
    } catch (err) {
      console.error("Update ItemType Error:", err);
      res.status(500).json({ message: "Error updating Item Type" });
    }
  },
];

// DELETE Item Type
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_unite } = req.params;

    try {
      const itemType = await ItemsTypes.findByPk(id_unite);
      if (!itemType) {
        return res.status(404).json({ message: "Item Type not found" });
      }

      await itemType.destroy();
      res.status(200).json({ message: "Item Type deleted successfully" });
    } catch (err) {
      console.error("Delete ItemType Error:", err);
      res.status(500).json({ message: "Error deleting Item Type" });
    }
  },
];
