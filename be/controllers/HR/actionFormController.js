// controllers/HR/actionFormController.js
const ActionForm = require('../../models/hr/ActionForm');
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

exports.createAction = [
  verifyToken,
  async (req, res) => {
    try {
      const row = await ActionForm.create({
        Date_transaction: req.body.Date_transaction,
        Usr: req.user?.id ?? req.body.Usr,
        id_emp: req.body.id_emp,
        old_basic_salary: req.body.old_basic_salary,
        new_basic_salary: req.body.new_basic_salary,
        old_job: req.body.old_job,
        new_job: req.body.new_job,
        old_num_job: req.body.old_num_job,
        new_num_job: req.body.new_num_job,
        old_degree: req.body.old_degree,
        new_degree: req.body.new_degree,
        old_level_candidate: req.body.old_level_candidate,
        new_level_candidate: req.body.new_level_candidate,
        add_value: req.body.add_value,
        comment: req.body.comment,
        Evaluation_EMP: req.body.Evaluation_EMP,
      });
      res.status(201).json({ message: 'Action created', action: row });
    } catch (err) {
      console.error('createAction error:', err);
      res.status(500).json({ message: 'Error creating action' });
    }
  }
];

exports.getActionsByEmployee = [
  verifyToken,  
  async (req, res) => {
    try {
      const rows = await ActionForm.findAll({ where: { id_emp: req.params.employeeId }, order: [['Date_transaction', 'DESC']] });
      res.json(rows);
    } catch (err) {
      console.error('getActionsByEmployee error:', err);
      res.status(500).json({ message: 'Error fetching actions' });
    }
  }
];
