// controllers/HR/tsCodeController.js
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const TSCode = require("../../models/hr/TSCode");
const Timesheet = require("../../models/hr/Timesheet");

// ===== JWT (same pattern you use) =====
const verifyToken = (req, res, next) => {
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

function normBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["1", "true", "yes", "y", "on"].includes(v.toLowerCase());
  return false;
}

function normStr(v, max = 255) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normCode(v) {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  return s || null;
}

function normInt(v, def = 0) {
  if (v === "" || v == null) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

function buildCodePayload(body) {
  const code = normCode(body.code);
  const desig_can = normStr(body.desig_can ?? body.label ?? body.name, 255);
  const max_day = Math.max(0, normInt(body.max_day, 0));
  const Rule_days = normStr(body.Rule_days ?? "", 2000) ?? ""; // keep string
  // Optional columns (if your TS_Codes table has them)
  const description = normStr(body.description, 2000);
  const color = normStr(body.color, 64);

  // Optional boolean columns (if your TS_Codes table has them)
  const food_allowance = normBool(body.food_allowance);
  const comm_allowance = normBool(body.comm_allowance);
  const trans_allowance = normBool(body.trans_allowance);

  return {
    code,
    desig_can,
    max_day,
    Rule_days,
    description,
    color,
    food_allowance,
    comm_allowance,
    trans_allowance,
  };
}

// Checks whether a code is referenced in any Timesheet day code column j_1..j_31
async function isCodeUsedInTimesheets(code) {
  if (!code) return false;
  const ors = [];
  for (let i = 1; i <= 31; i++) {
    ors.push({ [`j_${i}`]: code });
  }
  const hit = await Timesheet.findOne({
    where: { [Op.or]: ors },
    attributes: ["id_emp"],
    raw: true,
  });
  return !!hit;
}

exports.list = [
  verifyToken,
  async (req, res) => {
    try {
      // optional: ?q= or ?type=leave|timesheet
      const q = (req.query.q ? String(req.query.q).trim() : "") || "";
      const type = req.query.type ? String(req.query.type) : "";

      const whereObj = {};
      if (q) {
        whereObj[Op.or] = [
          { code: { [Op.like]: `%${q}%` } },
          { desig_can: { [Op.like]: `%${q}%` } },
        ];
      }
      if (type === "leave") {
        whereObj.max_day = { [Op.gt]: 0 };
      } else if (type === "timesheet") {
        whereObj.max_day = 0;
      }

      const rows = await TSCode.findAll({
        where: whereObj,
        order: [["code", "ASC"]],
        raw: true,
      });

      return res.json(rows);
    } catch (e) {
      console.error("[TSCode.list]", e);
      return res.status(500).json({ message: "Failed to load codes" });
    }
  },
];

exports.create = [
  verifyToken,
  async (req, res) => {
    try {
      const payload = buildCodePayload(req.body || {});
      if (!payload.code || !payload.desig_can) {
        return res.status(400).json({ message: "code and desig_can are required" });
      }

      // unique by code
      const exists = await TSCode.findOne({ where: { code: payload.code }, raw: true });
      if (exists) {
        return res.status(409).json({ message: `Code already exists: ${payload.code}` });
      }

      const created = await TSCode.create(payload);
      return res.status(201).json(created);
    } catch (e) {
      console.error("[TSCode.create]", e);
      return res.status(500).json({ message: "Failed to create code" });
    }
  },
];

exports.update = [
  verifyToken,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const row = await TSCode.findByPk(id);
      if (!row) return res.status(404).json({ message: "Code not found" });

      const payload = buildCodePayload(req.body || {});
      if (!payload.code || !payload.desig_can) {
        return res.status(400).json({ message: "code and desig_can are required" });
      }

      // If code is changing, enforce uniqueness
      const oldCode = String(row.code || "").toUpperCase();
      if (payload.code !== oldCode) {
        const exists = await TSCode.findOne({
          where: { code: payload.code, int_can: { [Op.ne]: id } },
          raw: true,
        });
        if (exists) {
          return res.status(409).json({ message: `Code already exists: ${payload.code}` });
        }

        // optional safety: prevent changing code if already used in timesheets
        const used = await isCodeUsedInTimesheets(oldCode);
        if (used) {
          return res.status(400).json({
            message: `Cannot change code "${oldCode}" because it is used in timesheets. Create a new code instead.`,
          });
        }
      }

      await row.update(payload);
      return res.json(row);
    } catch (e) {
      console.error("[TSCode.update]", e);
      return res.status(500).json({ message: "Failed to update code" });
    }
  },
];

exports.remove = [
  verifyToken,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const row = await TSCode.findByPk(id, { raw: true });
      if (!row) return res.status(404).json({ message: "Code not found" });

      // Prevent deleting if used
      const used = await isCodeUsedInTimesheets(String(row.code || "").toUpperCase());
      if (used) {
        return res.status(400).json({
          message: `Cannot delete code "${row.code}" because it is used in timesheets.`,
        });
      }

      await TSCode.destroy({ where: { int_can: id } });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[TSCode.remove]", e);
      return res.status(500).json({ message: "Failed to delete code" });
    }
  },
];
