const Supplier_settlement = require("../../../models/Purchase/Supplier_settlement");
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

// GET all Supplier Settlements
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const data = await Supplier_settlement.findAll();
      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Supplier Settlements Error:", err);
      res.status(500).json({ message: "Error fetching Supplier Settlements" });
    }
  },
];

// CREATE new Supplier Settlement
exports.create = [
  verifyToken,
  async (req, res) => {
    const {
      date_settlement,
      client,
      Debit_Money,
      Credit_Money,
      Debit_Gold,
      Credit_Gold,
      Comment,
      Brand,
      Reference_number,
      currency, ExchangeRate, ExchangeRateToLYD, Paidby,discount_by_vendor
    } = req.body;

    if (!date_settlement || !client || !Reference_number || !currency) {
      return res.status(400).json({
        message: "'date_settlement', 'client', 'Reference_number', and 'currency' are required",
      });
    }

    try {
      await Supplier_settlement.create({
        date_settlement,
        client,
        Debit_Money,
        Credit_Money,
        Debit_Gold,
        Credit_Gold,
        Comment,
        Brand,
        Reference_number,
        currency, ExchangeRate, ExchangeRateToLYD, Paidby,
        discount_by_vendor :0
      });
      res.status(201).json({ message: "Vendor Payment created successfully" });
    } catch (err) {
      console.error("Create Supplier Settlement Error:", err);
      res.status(500).json({ message: "Error creating Supplier Settlement" });
    }
  },
];

// UPDATE existing Supplier Settlement
exports.update = [
  verifyToken,
  async (req, res) => {
    const { id_settlement } = req.params;
    const {
      date_settlement,
      client,
      Debit_Money,
      Credit_Money,
      Debit_Gold,
      Credit_Gold,
      Comment,
      Brand,
      Reference_number,
      currency, ExchangeRate, ExchangeRateToLYD, Paidby,
      discount_by_vendor
    } = req.body;

    if (!date_settlement || !client || !Reference_number || !currency) {
      return res.status(400).json({
        message: "'date_settlement', 'client', 'Reference_number', and 'currency' are required",
      });
    }

    try {
      const settlement = await Supplier_settlement.findByPk(id_settlement);
      if (!settlement) {
        return res.status(404).json({ message: "Supplier Settlement not found" });
      }

      await settlement.update({
        date_settlement,
        client,
        Debit_Money,
        Credit_Money,
        Debit_Gold,
        Credit_Gold,
        Comment,
        Brand,
        Reference_number,
        currency, ExchangeRate,
        ExchangeRateToLYD, Paidby,
        discount_by_vendor:0
      });
      res.status(200).json({ message: "Supplier Settlement updated successfully" });
    } catch (err) {
      console.error("Update Supplier Settlement Error:", err);
      res.status(500).json({ message: "Error updating Supplier Settlement" });
    }
  },
];

// DELETE Supplier Settlement
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { id_settlement } = req.params;

    try {
      const settlement = await Supplier_settlement.findByPk(id_settlement);
      if (!settlement) {
        return res.status(404).json({ message: "Supplier Settlement not found" });
      }

      await settlement.destroy();
      res.status(200).json({ message: "Supplier Settlement deleted successfully" });
    } catch (err) {
      console.error("Delete Supplier Settlement Error:", err);
      res.status(500).json({ message: "Error deleting Supplier Settlement" });
    }
  },
];