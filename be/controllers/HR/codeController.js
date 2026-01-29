const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const TSCode = require('../../models/hr/TSCode');

const verifyToken = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ message: 'Authorization header missing' });
  const token = h.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

exports.list = [verifyToken, async (_req, res) => {
  const rows = await TSCode.findAll({ order: [['int_can','ASC']] });
  res.json(rows);
}];

exports.create = [verifyToken, async (req, res) => {
  const { desig_can, code, max_day, Rule_days, description, color, food_allowance, comm_allowance, trans_allowance } = req.body || {};
  if (!desig_can || !code) return res.status(400).json({ message: 'code and desig_can are required' });
  const exists = await TSCode.findOne({ where: { code } });
  if (exists) return res.status(409).json({ message: 'Code already exists' });
  const row = await TSCode.create({
    desig_can: String(desig_can).trim(),
    code: String(code).trim().toUpperCase(),
    max_day: Number.isFinite(+max_day) ? +max_day : 0,
    Rule_days: String(Rule_days || '').trim(),
    description: description ?? null,
    color: color ?? null,
    food_allowance: food_allowance != null ? !!food_allowance : false,
    comm_allowance: comm_allowance != null ? !!comm_allowance : false,
    trans_allowance: trans_allowance != null ? !!trans_allowance : false,
  });
  res.status(201).json(row);
}];

exports.update = [verifyToken, async (req, res) => {
  const id = req.params.int_can;
  const row = await TSCode.findByPk(id);
  if (!row) return res.status(404).json({ message: 'Code not found' });

  const { desig_can, code, max_day, Rule_days, description, color, food_allowance, comm_allowance, trans_allowance } = req.body || {};
  if (code) {
    const conflict = await TSCode.findOne({ where: { code, int_can: { [Op.ne]: row.int_can } } });
    if (conflict) return res.status(409).json({ message: 'Another code with the same code exists' });
  }

  await row.update({
    desig_can: desig_can ?? row.desig_can,
    code: code ? String(code).trim().toUpperCase() : row.code,
    max_day: max_day != null ? +max_day : row.max_day,
    Rule_days: Rule_days ?? row.Rule_days,
    description: description ?? row.description,
    color: color ?? row.color,
    food_allowance: food_allowance != null ? !!food_allowance : row.food_allowance,
    comm_allowance: comm_allowance != null ? !!comm_allowance : row.comm_allowance,
    trans_allowance: trans_allowance != null ? !!trans_allowance : row.trans_allowance,
  });
  res.json(row);
}];

exports.remove = [verifyToken, async (req, res) => {
  const id = req.params.int_can;
  const row = await TSCode.findByPk(id);
  if (!row) return res.status(404).json({ message: 'Code not found' });
  await row.destroy();
  res.json({ ok: true });
}];
