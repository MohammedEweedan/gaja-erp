// controllers/HR/trainingController.js
const Training = require('../../models/hr/Training');
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

exports.createTraining = [
  verifyToken,
  async (req, res) => {
    try {
      const row = await Training.create({
        DATE_S: req.body.DATE_S,
        DATE_E: req.body.DATE_E,
        TYPE: req.body.TYPE,
        id_emp: req.body.id_emp,
        NIVEAU: req.body.NIVEAU,
        CONSEIL: req.body.CONSEIL,
        ETABLISSEMENT: req.body.ETABLISSEMENT,
      });
      res.status(201).json({ message: 'Training created', training: row });
    } catch (err) {
      console.error('createTraining error:', err);
      res.status(500).json({ message: 'Error creating training' });
    }
  }
];

exports.getTrainings = [
  verifyToken,
  async (_req, res) => {
    try {
      const rows = await Training.findAll({ order: [['DATE_S', 'DESC']] });
      res.json(rows);
    } catch (err) {
      console.error('getTrainings error:', err);
      res.status(500).json({ message: 'Error fetching trainings' });
    }
  }
];

exports.getTrainingsByEmployee = [
  verifyToken,
  async (req, res) => {
    try {
      const rows = await Training.findAll({ where: { id_emp: req.params.employeeId }, order: [['DATE_S', 'DESC']] });
      res.json(rows);
    } catch (err) {
      console.error('getTrainingsByEmployee error:', err);
      res.status(500).json({ message: 'Error fetching trainings' });
    }
  }
];
