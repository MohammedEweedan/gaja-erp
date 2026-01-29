// controllers/HR/specialiteController.js
const Specialite = require('../../models/hr/Specialite');
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Unauthorized" });
    req.user = decoded;
    next();
  });
};

exports.createSpecialite = [
  verifyToken,
  async (req, res) => {
    try {
      const payload = {
        nom_specialite: req.body.nom_specialite,
      };
      const specialite = await Specialite.create(payload);
      res.status(201).json({ message: 'Specialite created', specialite });
    } catch (err) {
      console.error('createSpecialite error:', err);
      res.status(500).json({ message: 'Error creating specialite' });
    }
  },
];

exports.getSpecialites = [
  verifyToken,
  async (_req, res) => {
    try {
      const specialites = await Specialite.findAll();
      res.json(specialites);
    } catch (err) {
      console.error('getSpecialites error:', err);
      res.status(500).json({ message: 'Error fetching specialites' });
    }
  },
];

exports.updateSpecialite = [
  verifyToken,
  async (req, res) => {
    try {
      const specialiteId = req.params.id_specialite;
      if (!specialiteId) {
        return res.status(400).json({ message: "Specialite ID is required" });
      }

      const specialite = await Specialite.findOne({
        where: { id_specialite: specialiteId }
      });

      if (!specialite) {
        return res.status(404).json({ message: "Specialite not found" });
      }

      await specialite.update({
        nom_specialite: req.body.nom_specialite,
      });

      res.status(200).json({ message: "Specialite updated successfully", specialite });
    } catch (err) {
      console.error('updateSpecialite error:', err);
      res.status(500).json({
        message: err.message || "Error updating specialite"
      });
    }
  },
];

exports.deleteSpecialite = [
  verifyToken,
  async (req, res) => {
    try {
      const specialiteId = req.params.id_specialite;
      if (!specialiteId) {
        return res.status(400).json({ message: "Specialite ID is required" });
      }

      const specialite = await Specialite.findOne({
        where: { id_specialite: specialiteId }
      });

      if (!specialite) {
        return res.status(404).json({ message: "Specialite not found" });
      }

      await specialite.destroy();

      res.status(200).json({ message: "Specialite deleted successfully" });
    } catch (err) {
      console.error("deleteSpecialite error:", err);
      res.status(500).json({
        message: err.message || "Error deleting specialite"
      });
    }
  },
];
