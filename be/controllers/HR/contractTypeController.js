// controllers/HR/contractTypeController.js
const ContractType = require('../../models/hr/ContractType');
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

exports.createContractType = [
  verifyToken,
  async (req, res) => {
    try {
      const payload = {
        contract_name: req.body.contract_name,
        contract_code: req.body.contract_code || null,
        description: req.body.description || null,
      };
      const contractType = await ContractType.create(payload);
      res.status(201).json({ message: 'Contract type created', contractType });
    } catch (err) {
      console.error('createContractType error:', err);
      res.status(500).json({ message: 'Error creating contract type' });
    }
  },
];

exports.getContractTypes = [
  verifyToken,
  async (_req, res) => {
    try {
      const contractTypes = await ContractType.findAll();
      res.json(contractTypes);
    } catch (err) {
      console.error('getContractTypes error:', err);
      res.status(500).json({ message: 'Error fetching contract types' });
    }
  },
];

exports.updateContractType = [
  verifyToken,
  async (req, res) => {
    try {
      const contractTypeId = req.params.id_contract_type;
      if (!contractTypeId) {
        return res.status(400).json({ message: "Contract type ID is required" });
      }

      const contractType = await ContractType.findOne({
        where: { id_contract_type: contractTypeId }
      });

      if (!contractType) {
        return res.status(404).json({ message: "Contract type not found" });
      }

      await contractType.update({
        contract_name: req.body.contract_name,
        contract_code: req.body.contract_code || null,
        description: req.body.description || null,
      });

      res.status(200).json({ message: "Contract type updated successfully", contractType });
    } catch (err) {
      console.error('updateContractType error:', err);
      res.status(500).json({
        message: err.message || "Error updating contract type"
      });
    }
  },
];

exports.deleteContractType = [
  verifyToken,
  async (req, res) => {
    try {
      const contractTypeId = req.params.id_contract_type;
      if (!contractTypeId) {
        return res.status(400).json({ message: "Contract type ID is required" });
      }

      const contractType = await ContractType.findOne({
        where: { id_contract_type: contractTypeId }
      });

      if (!contractType) {
        return res.status(404).json({ message: "Contract type not found" });
      }

      await contractType.destroy();

      res.status(200).json({ message: "Contract type deleted successfully" });
    } catch (err) {
      console.error("deleteContractType error:", err);
      res.status(500).json({
        message: err.message || "Error deleting contract type"
      });
    }
  },
];
