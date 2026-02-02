const COA = require("../../models/Finance/COA");
const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    req.user = decoded;
    next();
  });
};

exports.find = [
  authenticate,
  async (req, res) => {
    try {
      const data = await COA.findAll();
      res.json(data);
    } catch (dbErr) {
      console.error("Fetch COA Error:", dbErr);
      res.status(500).json({ message: "Error fetching Chart of Accounts" });
    }
  }
];

exports.create = [
  authenticate,
  async (req, res) => {
    const {
      Acc_No,
      Name_M,
      Date_m,
      State,
      solde_initiale,
      type_acc,
      ancien_acc_no,
      percent_budget,
      solde_by_currency,
      d1,
      d2,
      L10
    } = req.body;

    if (!Acc_No || !Name_M) {
      return res.status(400).json({ message: "Account number and name are required" });
    }

    try {
      await COA.create({
        Acc_No,
        Name_M,
        Date_m,
        State,
        solde_initiale,
        type_acc,
        ancien_acc_no,
        percent_budget,
        solde_by_currency,
        d1,
        d2,
        L10
      });
      res.status(201).json({ message: "Account created successfully" });
    } catch (error) {
      console.error("Create COA Error:", error);
      res.status(500).json({ message: error.message });
    }
  }
];

exports.update = [
  authenticate,
  async (req, res) => {
    const id = req.params.id; // Assuming `IND` is your primary key
    const {
      Acc_No,
      Name_M,
      Date_m,
      State,
      solde_initiale,
      type_acc,
      ancien_acc_no,
      percent_budget,
      solde_by_currency,
      d1,
      d2,
      L10
    } = req.body;

    try {
      const account = await COA.findByPk(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      await account.update({
        Acc_No,
        Name_M,
        Date_m,
        State,
        solde_initiale,
        type_acc,
        ancien_acc_no,
        percent_budget,
        solde_by_currency,
        d1,
        d2,
        L10
      });

      res.status(200).json({ message: "Account updated successfully" });
    } catch (error) {
      console.error("Update COA Error:", error);
      res.status(500).json({ message: "Error updating account" });
    }
  }
];

exports.delete = [
  authenticate,
  async (req, res) => {
    const id = req.params.id;

    try {
      const account = await COA.findByPk(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      await account.destroy();
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete COA Error:", error);
      res.status(500).json({ message: "Error deleting account" });
    }
  }
];
