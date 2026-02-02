// Simple change logger
// controllers/HR/employeeController.js

const Employee = require("../../models/hr/employee1");
const jwt = require("jsonwebtoken");
const { Op } = require('sequelize');
const express = require("express");
const fs = require('fs');
const path = require('path');

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

const CHANGE_LOG = path.join(__dirname, '../../logs/hr-change-log.json');
function appendChangeLog(entry) {
  try {
    const dir = path.dirname(CHANGE_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let arr = [];
    if (fs.existsSync(CHANGE_LOG)) {
      try { arr = JSON.parse(fs.readFileSync(CHANGE_LOG, 'utf8') || '[]') || []; } catch {}
    }
    arr.push(entry);
    fs.writeFileSync(CHANGE_LOG, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.warn('[employeeController] change log failed:', e?.message || e);
  }
}

// Cache existing DB column names for EMPLOYEE1 (real physical column names)
let _empColumnsCache = null;
let _safeAttrCache = null;
async function getExistingEmpColumns(sequelize) {
  if (_empColumnsCache) return _empColumnsCache;
  const [rows] = await sequelize.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EMPLOYEE1'
  `);
  const set = new Set(rows.map(r => String(r.COLUMN_NAME).toUpperCase()));
  _empColumnsCache = set;
  return set;
}

async function getSafeEmployeeAttributes() {
  if (_safeAttrCache) return _safeAttrCache;
  const existingCols = await getExistingEmpColumns(Employee.sequelize);
  const safeAttributes = [];
  for (const [attrName, def] of Object.entries(Employee.rawAttributes)) {
    const col = String(def.field || attrName).toUpperCase();
    if (existingCols.has(col)) safeAttributes.push(attrName);
  }
  if (!safeAttributes.includes("ID_EMP")) safeAttributes.push("ID_EMP");
  _safeAttrCache = safeAttributes;
  return safeAttributes;
}

// map model attribute -> actual db column name
function attributeToDbColumn(attrName) {
  const def = Employee.rawAttributes[attrName];
  if (!def) return attrName;
  return (def.field || attrName);
}

// GET all Employees (hardened: only select columns that actually exist in DB)
exports.find = [
  verifyToken,
  async (req, res) => {
    try {
      const { search, state, PS } = req.query || {};

      // Build filters
      const where = {};
      if (typeof state !== 'undefined') {
        const v = String(state).toLowerCase();
        if (v === 'true') where.STATE = true;
        if (v === 'false') where.STATE = false;
      }
      if (PS) {
        const list = String(PS).split(',').map(x => x.trim()).filter(Boolean).map(Number);
        if (list.length) where.PS = { [Op.in]: list };
      }
      if (search && String(search).trim() !== '') {
        const like = `%${String(search).trim()}%`;
        where[Op.or] = [
          { NAME: { [Op.like]: like } },
          { TITLE: { [Op.like]: like } },
          { EMAIL: { [Op.like]: like } },
          { PHONE: { [Op.like]: like } },
        ];
      }

      // ---- AUTO-DETECT EXISTING COLUMNS IN DB ----
      const existingCols = await getExistingEmpColumns(Employee.sequelize);
      const safeAttributes = [...await getSafeEmployeeAttributes()];

      const missing = [];
      for (const [attrName, def] of Object.entries(Employee.rawAttributes)) {
        const col = String(def.field || attrName).toUpperCase();
        if (!existingCols.has(col)) missing.push(`${attrName} -> ${def.field || attrName}`);
      }

      if (missing.length) {
        console.warn(
          '[Employees.find] Skipping missing columns in DB:',
          missing.join(', ')
        );
      }

      const data = await Employee.findAll({
        where,
        attributes: safeAttributes
      });

      res.status(200).json(data);
    } catch (err) {
      console.error("Fetch Employees Error:", err);
      res.status(500).json({ message: "Error fetching Employees" });
    }
  },
];

// PARTIAL UPDATE (PATCH): update only provided fields, no NAME requirement
exports.patch = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;
    const body = req.body || {};

    try {
      // existence check
      const safeAttributes = await getSafeEmployeeAttributes();
      const existing = await Employee.findOne({
        where: { ID_EMP },
        attributes: safeAttributes,
        raw: true,
      });
      if (!existing) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Build payload from allowed attributes, only keys present in body
      const allowed = Object.keys(Employee.rawAttributes);
      const payload = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          payload[key] = body[key] === "" ? null : body[key];
        }
      }

      // Never allow client to touch audit columns
      delete payload.CREATED_AT;
      delete payload.UPDATED_AT;

      // Optional: trim NAME if provided (but don't require it)
      if (typeof payload.NAME === "string") {
        payload.NAME = payload.NAME.trim();
        if (payload.NAME === "") delete payload.NAME;
      }

      // Type coercions
      if (payload.PS != null) payload.PS = Number(payload.PS);
      if (Object.prototype.hasOwnProperty.call(payload, "STATE"))
        payload.STATE = !!payload.STATE;
      if (Object.prototype.hasOwnProperty.call(payload, "IS_FOREINGHT"))
        payload.IS_FOREINGHT = !!payload.IS_FOREINGHT;
      if (Object.prototype.hasOwnProperty.call(payload, "FINGERPRINT_NEEDED"))
        payload.FINGERPRINT_NEEDED = !!payload.FINGERPRINT_NEEDED;

      // TIME-only normalization (expect HH:mm or HH:mm:ss)
      const normalizeTime = (val) => {
        if (val == null || val === "") return null;
        const s = String(val).trim();
        if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
        if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
        return null;
      };
      if (Object.prototype.hasOwnProperty.call(payload, "T_START"))
        payload.T_START = normalizeTime(payload.T_START);
      if (Object.prototype.hasOwnProperty.call(payload, "T_END"))
        payload.T_END = normalizeTime(payload.T_END);

      // TITLE clamp (DB is VARCHAR(20))
      if (typeof payload.TITLE === "string") payload.TITLE = payload.TITLE.slice(0, 20);

      // If PICTURE_URL is a data URL, move it to BLOB and clear URL
      if (typeof payload.PICTURE_URL === "string" && payload.PICTURE_URL.startsWith("data:image")) {
        const idx = payload.PICTURE_URL.indexOf(",");
        const b64 = idx >= 0 ? payload.PICTURE_URL.slice(idx + 1) : payload.PICTURE_URL;
        try {
          payload.PICTURE = Buffer.from(b64, "base64");
          payload.PICTURE_URL = null;
        } catch {
          if (payload.PICTURE_URL.length > 500) payload.PICTURE_URL = payload.PICTURE_URL.slice(0, 500);
        }
      } else if (typeof payload.PICTURE_URL === "string" && payload.PICTURE_URL.length > 500) {
        payload.PICTURE_URL = payload.PICTURE_URL.slice(0, 500);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "PICTURE") && !Buffer.isBuffer(payload.PICTURE)) {
        delete payload.PICTURE;
      }

      // Date fields: accept 'YYYY-MM-DD' or 'DD-MM-YYYY', then set via CONVERT(date,...,23)
      const toSqlYmd = (val) => {
        if (!val) return null;
        let s = String(val).slice(0, 10);
        if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split("-");
          s = `${yyyy}-${mm}-${dd}`;
        }
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      };
      const dateFields = ["DATE_OF_BIRTH", "CONTRACT_START", "CONTRACT_END", "RENEWABLE_CONTRACT"];
      const dateUpdates = {};
      for (const k of dateFields) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) {
          const ymd = toSqlYmd(payload[k]);
          // remove from main payload, we’ll update with explicit SQL
          delete payload[k];
          if (ymd) dateUpdates[k] = ymd;
        }
      }

      // 1) Non-date fields
      let didUpdate = false;
      if (Object.keys(payload).length) {
        await Employee.update(payload, { where: { ID_EMP } });
        didUpdate = true;
      }

      // 2) Date fields (explicit conversion)
      for (const [col, ymd] of Object.entries(dateUpdates)) {
        try {
          await Employee.sequelize.query(
            `UPDATE [EMPLOYEE1] SET [${col}] = CONVERT(date, :val, 23) WHERE [ID_EMP] = :id`,
            { replacements: { val: ymd, id: ID_EMP } }
          );
        } catch (e) {
          console.warn(`PATCH date update failed for ${col} with value ${ymd}:`, e?.parent?.message || e?.message);
        }
      }

      // Change logging for salary and allowance fields
      if (didUpdate) {
        const fieldsOfInterest = ['BASIC_SALARY','FOOD','FUEL','COMMUNICATION','FOOD_ALLOWANCE'];
        const diffs = {};
        for (const f of fieldsOfInterest) {
          if (Object.prototype.hasOwnProperty.call(payload, f)) {
            const before = existing ? existing[f] : undefined;
            const after = payload[f];
            if (String(before) !== String(after)) diffs[f] = { before, after };
          }
        }
        if (Object.keys(diffs).length) {
          appendChangeLog({
            ts: new Date().toISOString(),
            actor: req.user?.id || req.user?.email || 'unknown',
            id_emp: ID_EMP,
            changes: diffs,
            source: 'PATCH /employees/:ID_EMP'
          });
        }
      }

      return res.status(200).json({ message: "Employee patched successfully" });
    } catch (err) {
      console.error("Patch Employee Error:", err);
      return res.status(500).json({ message: "Error patching Employee" });
    }
  },
];

// GET single Employee by ID
exports.findOne = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;
    try {
      const safeAttributes = await getSafeEmployeeAttributes();
      const existingCols = await getExistingEmpColumns(Employee.sequelize);
      const hasJobRelation = existingCols.has('JOB_RELATION');
      const include = hasJobRelation
        ? [
            { model: Employee, as: 'manager', attributes: ['ID_EMP', 'NAME'] },
            { model: Employee, as: 'subordinates', attributes: ['ID_EMP', 'NAME'] },
          ]
        : [];
      const employee = await Employee.findByPk(ID_EMP, {
        attributes: safeAttributes,
        include,
      });

      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      res.status(200).json(employee);
    } catch (err) {
      console.error('Fetch Employee Error:', err);
      res.status(500).json({ message: 'Error fetching Employee' });
    }
  },
];

// GET subordinates for an Employee
exports.getSubordinates = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;
    try {
      const subordinates = await Employee.findAll({
        where: { MANAGER_ID: ID_EMP },
        attributes: ['ID_EMP', 'NAME', 'TITLE'],
      });
      res.status(200).json(subordinates);
    } catch (err) {
      console.error('Fetch Subordinates Error:', err);
      res.status(500).json({ message: 'Error fetching subordinates' });
    }
  },
];

// POST employee picture (multipart/form-data file -> save to BLOB)
exports.uploadPicture = [
  async (req, res) => {
    try {
      const { ID_EMP } = req.params;
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      // Ensure employee exists
      const exists = await Employee.findOne({ where: { ID_EMP }, attributes: ['ID_EMP'], raw: true });
      if (!exists) return res.status(404).json({ message: 'Employee not found' });

      // Ensure target directory exists: uploads/user-pic/:ID_EMP
      const baseDir = path.join(__dirname, '../../uploads', 'user-pic', String(ID_EMP));
      fs.mkdirSync(baseDir, { recursive: true });
      // Always write as profile.jpg
      const filename = 'profile.jpg';
      const filePath = path.join(baseDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      // Build a URL that aligns with static serving in index.js
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/user-pic/${ID_EMP}/${filename}`;
      // Update DB: set URL
      await Employee.update({ PICTURE_URL: publicUrl }, { where: { ID_EMP } });
      // Clear BLOB with typed NULL to avoid nvarchar->varbinary implicit conversion
      await Employee.sequelize.query(
        'UPDATE [EMPLOYEE1] SET [PICTURE] = CAST(NULL AS VARBINARY(MAX)) WHERE [ID_EMP] = :id',
        { replacements: { id: ID_EMP } }
      );
      return res.status(200).json({ message: 'Picture uploaded', preview: publicUrl });
    } catch (e) {
      console.error('uploadPicture error:', e);
      return res.status(500).json({ message: 'Error uploading picture' });
    }
  }
];

// DELETE employee picture: removes disk file (if any) and clears DB columns
exports.deletePicture = [
  async (req, res) => {
    try {
      const { ID_EMP } = req.params;
      const emp = await Employee.findOne({ where: { ID_EMP } });
      if (!emp) return res.status(404).json({ message: 'Employee not found' });

      // Compute file path and delete if present
      const baseDir = path.join(__dirname, '../../uploads', 'user-pic', String(ID_EMP));
      const filePath = path.join(baseDir, 'profile.jpg');
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('deletePicture unlink warning:', e.message);
      }

      // Clear DB fields: set URL null and BLOB to typed NULL
      await Employee.update({ PICTURE_URL: null }, { where: { ID_EMP } });
      await Employee.sequelize.query(
        'UPDATE [EMPLOYEE1] SET [PICTURE] = CAST(NULL AS VARBINARY(MAX)) WHERE [ID_EMP] = :id',
        { replacements: { id: ID_EMP } }
      );
      return res.status(200).json({ message: 'Picture removed' });
    } catch (e) {
      console.error('deletePicture error:', e);
      return res.status(500).json({ message: 'Error removing picture' });
    }
  }
];

// Utility: guess mime from buffer magic bytes
function guessImageMime(buf) {
  if (!buf || buf.length < 4) return 'application/octet-stream';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg';
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  // WebP (RIFF....WEBP)
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  return 'application/octet-stream';
}

// GET employee picture (BLOB stream or redirect to URL)
exports.getPicture = [
  async (req, res) => {
    try {
      const { ID_EMP } = req.params;
      const emp = await Employee.findByPk(ID_EMP, { attributes: ['PICTURE', 'PICTURE_URL'] });
      if (!emp) return res.status(404).send('Not found');

      // If BLOB exists, stream it
      if (emp.PICTURE && emp.PICTURE.length) {
        res.setHeader('Content-Type', guessImageMime(emp.PICTURE));
        return res.status(200).send(emp.PICTURE);
      }
      // If URL exists, redirect
      if (emp.PICTURE_URL) {
        if (typeof emp.PICTURE_URL === 'string' && emp.PICTURE_URL.startsWith('data:')) {
          return res.status(415).send('Unsupported media stored as data URL');
        }
        return res.redirect(302, emp.PICTURE_URL);
      }
      // Fallback: if file exists on disk, stream it
      try {
        const baseDir = path.join(__dirname, '../../uploads', 'user-pic', String(ID_EMP));
        const filePath = path.join(baseDir, 'profile.jpg');
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          res.setHeader('Content-Type', guessImageMime(buf));
          return res.status(200).send(buf);
        }
      } catch (e) {
        console.warn('getPicture disk fallback warning:', e.message);
      }
      return res.status(404).send('No picture');
    } catch (e) {
      console.error('getPicture error:', e);
      return res.status(500).send('Error');
    }
  }
];

// POST: Calculate leave balance for an Employee
exports.calculateLeaveBalance = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;
    try {
      const employee = await Employee.findByPk(ID_EMP);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      // Instance method defined on the model
      if (typeof employee.calculateLeaveBalance === 'function') {
        await employee.calculateLeaveBalance();
      }
      res.status(200).json({ message: 'Leave balance recalculated', LEAVE_BALANCE: employee.LEAVE_BALANCE });
    } catch (err) {
      console.error('Calculate Leave Balance Error:', err);
      res.status(500).json({ message: 'Error calculating leave balance' });
    }
  },
];

// CREATE new Employee
exports.create = [
  verifyToken,
  async (req, res) => {
    const { NAME, TITLE, EMAIL, PHONE, COST_CENTER, STATE, PS, PICTURE_URL } = req.body || {};
    console.log(req.body);
    if (!NAME || String(NAME).trim() === "") {
      return res.status(400).json({
        message: "'NAME' is required",
      });
    }

    try {
      // If client sent a base64 data URL, decode it and store in PICTURE (BLOB)
      let pictureBuffer = null;
      let pictureUrlColumn = PICTURE_URL ?? null;
      if (typeof PICTURE_URL === 'string' && PICTURE_URL.startsWith('data:image')) {
        const idx = PICTURE_URL.indexOf(',');
        const b64 = idx >= 0 ? PICTURE_URL.slice(idx + 1) : PICTURE_URL;
        try { pictureBuffer = Buffer.from(b64, 'base64'); } catch (e) { pictureBuffer = null; }
        pictureUrlColumn = null; // don't try to store the massive data URL string in URL column
      } else if (typeof PICTURE_URL === 'string' && PICTURE_URL.length > 500) {
        pictureUrlColumn = PICTURE_URL.slice(0, 500);
      }

      // Normalize date fields from body (accept 'DD-MM-YYYY' or 'YYYY-MM-DD') to 'YYYY-MM-DD'
      const normalizeToYMD = (v) => {
        if (!v) return null;
        const s = String(v).slice(0,10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already Y-M-D
        const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return null; // unrecognized
      };
      const DATE_OF_BIRTH = normalizeToYMD(req.body?.DATE_OF_BIRTH);
      const CONTRACT_START = normalizeToYMD(req.body?.CONTRACT_START);
      const CONTRACT_END = normalizeToYMD(req.body?.CONTRACT_END);
      const RENEWABLE_CONTRACT = normalizeToYMD(req.body?.RENEWABLE_CONTRACT);

      // Minimal INSERT to create the row and get the new ID.
      // Some DBs may not have ID_EMP as IDENTITY, so we defensively compute the next ID.
      const clamp = (s, n) => (typeof s === 'string' ? s.slice(0, n) : s);

      let nextId = null;
      try {
        const [idRows] = await Employee.sequelize.query(
          "SELECT ISNULL(MAX([ID_EMP]),0)+1 AS nextId FROM [EMPLOYEE1];"
        );
        if (idRows && idRows[0] && idRows[0].nextId != null) {
          nextId = idRows[0].nextId;
        }
      } catch (e) {
        console.warn("[Employee.create] Failed to probe next ID_EMP:", e?.message || e);
      }

      let sql;
      const baseReplacements = {
        NAME: String(NAME).trim(),
        TITLE: TITLE ? clamp(TITLE, 20) : null,
        EMAIL: EMAIL ?? null,
        PHONE: PHONE ?? null,
        COST_CENTER: req.body?.COST_CENTER ?? null,
        PS: typeof PS === 'number' ? PS : (PS ? Number(PS) : null),
        STATE: typeof STATE === 'boolean' ? STATE : true,
        DATE_OF_BIRTH: DATE_OF_BIRTH ?? null,
        CONTRACT_START: CONTRACT_START ?? null,
        CONTRACT_END: CONTRACT_END ?? null,
        RENEWABLE_CONTRACT: RENEWABLE_CONTRACT ?? null,
      };

      if (nextId != null) {
        // Explicitly insert ID_EMP to satisfy non-IDENTITY definitions
        sql = `INSERT INTO [EMPLOYEE1] (
                     [ID_EMP],[NAME],[TITLE],[EMAIL],[PHONE],[COST_CENTER],[PS],[STATE],
                     [PICTURE_URL],[PICTURE],
                     [DATE_OF_BIRTH],[CONTRACT_START],[CONTRACT_END],[RENEWABLE_CONTRACT]
                   )
                   OUTPUT inserted.[ID_EMP]
                   VALUES (
                     :ID_EMP,:NAME,:TITLE,:EMAIL,:PHONE,:COST_CENTER,:PS,:STATE,
                     NULL,NULL,
                     :DATE_OF_BIRTH,:CONTRACT_START,:CONTRACT_END,:RENEWABLE_CONTRACT
                   );`;
      } else {
        // Fallback to original behaviour (for true IDENTITY columns)
        sql = `INSERT INTO [EMPLOYEE1] (
                     [NAME],[TITLE],[EMAIL],[PHONE],[COST_CENTER],[PS],[STATE],
                     [PICTURE_URL],[PICTURE],
                     [DATE_OF_BIRTH],[CONTRACT_START],[CONTRACT_END],[RENEWABLE_CONTRACT]
                   )
                   OUTPUT inserted.[ID_EMP]
                   VALUES (
                     :NAME,:TITLE,:EMAIL,:PHONE,:COST_CENTER,:PS,:STATE,
                     NULL,NULL,
                     :DATE_OF_BIRTH,:CONTRACT_START,:CONTRACT_END,:RENEWABLE_CONTRACT
                   );`;
      }

      const replacements = nextId != null
        ? { ...baseReplacements, ID_EMP: nextId }
        : baseReplacements;

      const [rows] = await Employee.sequelize.query(sql, { replacements });
      const newId = rows && rows[0] && (rows[0].ID_EMP || rows[0].id_emp || rows[0]['ID_EMP']);

      // Normalize remaining fields for UPDATE
      const norm = (v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        if (typeof v === 'string') {
          const s = v.trim();
          return s === '' ? null : s;
        }
        return v;
      };
      const numOrNull = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
      const boolOrNull = (v) => (typeof v === 'boolean' ? v : (v == null ? null : !!v));
      const toSqlYmd = (val) => {
        if (!val) return null;
        let s = String(val).slice(0, 10);
        if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split('-');
          s = `${yyyy}-${mm}-${dd}`;
        }
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      };

      const body = req.body || {};
      // If FE sent a data URL in PICTURE_URL, save it to disk and do NOT persist the data URL string
      const maybeDataUrl = typeof body.PICTURE_URL === 'string' ? body.PICTURE_URL : null;
      let persistedPictureUrl = null; // keep null to use /employees/:id/picture
      if (maybeDataUrl && /^data:image\/(png|jpe?g);base64,/i.test(maybeDataUrl)) {
        try {
          const base64 = maybeDataUrl.split(',')[1];
          const buf = Buffer.from(base64, 'base64');
          const dir = path.join(__dirname, '../../uploads', 'user-pic', String(newId));
          fs.mkdirSync(dir, { recursive: true });
          const filePath = path.join(dir, 'profile.jpg');
          fs.writeFileSync(filePath, buf);
          // Optionally set a short URL; frontend already uses /employees/:id/picture, so keep null
          persistedPictureUrl = null;
        } catch (e) {
          console.error('Create picture save failed:', e);
        }
      }
      const updatePayload = {
        ADDRESS: norm(body.ADDRESS),
        NATIONALITY: norm(body.NATIONALITY),
        NUM_OF_CHILDREN: numOrNull(body.NUM_OF_CHILDREN),
        EMPLOYER_REF: norm(body.EMPLOYER_REF),
        BANK: numOrNull(body.BANK),
        INVESTMENT: norm(body.INVESTMENT),
        FINANCE_NUM: norm(body.FINANCE_NUM),
        TYPE_OF_RECRUITMENT: norm(body.TYPE_OF_RECRUITMENT),
        DEGREE: norm(body.DEGREE),
        TYPE_OF_INSURANCE: norm(body.TYPE_OF_INSURANCE),
        NUM_OF_INSURANCE: norm(body.NUM_OF_INSURANCE),
        ACCOUNT_NUMBER: norm(body.ACCOUNT_NUMBER),
        MARITAL_STATUS: norm(body.MARITAL_STATUS),
        PLACE_OF_BIRTH: norm(body.PLACE_OF_BIRTH),
        NUM_CIN: norm(body.NUM_CIN),
        ISSUING_AUTH: norm(body.ISSUING_AUTH),
        FAM_BOOK_NUM: norm(body.FAM_BOOK_NUM),
        FAM_BOOK_ISSUING_AUTH: norm(body.FAM_BOOK_ISSUING_AUTH),
        PASSPORT_NUM: norm(body.PASSPORT_NUM),
        PASSPORT_ISSUING_AUTH: norm(body.PASSPORT_ISSUING_AUTH),
        ANNUAL_LEAVE_BAL: numOrNull(body.ANNUAL_LEAVE_BAL),
        GENDER: norm(body.GENDER),
        BLOOD_TYPE: norm(body.BLOOD_TYPE),
        DRIVER_LIC_NUM: norm(body.DRIVER_LIC_NUM),
        NAME_ENGLISH: norm(body.NAME_ENGLISH),
        SCIENTIFIC_CERT: norm(body.SCIENTIFIC_CERT),
        BASIC_SALARY: numOrNull(body.BASIC_SALARY),
        BASIC_SALARY_USD: numOrNull(body.BASIC_SALARY_USD),
        STATE: boolOrNull(body.STATE),
        NUM_NATIONAL: norm(body.NUM_NATIONAL),
        IS_FOREINGHT: boolOrNull(body.IS_FOREINGHT),
        FINGERPRINT_NEEDED: boolOrNull(body.FINGERPRINT_NEEDED),
        ATTACHED_NUMBER: norm(body.ATTACHED_NUMBER),
        JOB_AIM: norm(body.JOB_AIM),
        JOB_DESCRIPTION: norm(body.JOB_DESCRIPTION),
        JOB_RELATION: norm(body.JOB_RELATION),
        REQUEST_DEGREE: norm(body.REQUEST_DEGREE),
        PREFERRED_LANG: norm(body.PREFERRED_LANG),
        COST_CENTER: norm(body.COST_CENTER),
        MEDICAL_COMMENT: norm(body.MEDICAL_COMMENT),
        OUTFIT_NUM: norm(body.OUTFIT_NUM),
        FOOTWEAR_NUM: norm(body.FOOTWEAR_NUM),
        FOOD: numOrNull(body.FOOD),
        FUEL: numOrNull(body.FUEL),
        COMMUNICATION: numOrNull(body.COMMUNICATION),
        num_kid: norm(body.num_kid),
        GOLD_COMM: norm(body.GOLD_COMM),
        DIAMOND_COMM: body.DIAMOND_COMM == null || body.DIAMOND_COMM === '' ? null : Number(body.DIAMOND_COMM),
        FOOD_ALLOWANCE: numOrNull(body.FOOD_ALLOWANCE),
        GOLD_COMM_VALUE: body.GOLD_COMM_VALUE == null || body.GOLD_COMM_VALUE === '' ? null : Number(body.GOLD_COMM_VALUE),
        PS: numOrNull(body.PS),
        DIAMOND_COMM_TYPE: norm(body.DIAMOND_COMM_TYPE),
        // Do not store data URLs; use persistedPictureUrl (likely null) to avoid truncation
        PICTURE_URL: persistedPictureUrl,
        COMMENT: norm(body.COMMENT),
      };
      // Clamp TITLE to 20 on update as well
      if (body.TITLE) updatePayload.TITLE = clamp(body.TITLE, 20);
      // Manager mapping: accept MANAGER_ID or JOB_RELATION and store in JOB_RELATION (DB: JO_RELATION)
      const mgr = body.MANAGER_ID ?? body.JOB_RELATION;
      if (mgr !== undefined) {
        updatePayload.JOB_RELATION = (mgr === null || String(mgr).trim() === '') ? null : String(mgr).trim();
      }

      // Remove undefined keys (leave nulls explicitly)
      Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

      // Update non-date columns for the newly inserted employee
      if (newId) {
        const existingCols = await getExistingEmpColumns(Employee.sequelize);
        const filteredPayload = {};
        for (const [key, value] of Object.entries(updatePayload)) {
          if (existingCols.has(key.toUpperCase())) {
            filteredPayload[key] = value;
          }
        }

        if (Object.keys(filteredPayload).length) {
          await Employee.update(filteredPayload, { where: { ID_EMP: newId } });
        }

        // Now set date columns individually via CONVERT(date, ...)
        const datePairs = [
          ['DATE_OF_BIRTH', toSqlYmd(body.DATE_OF_BIRTH)],
          ['CONTRACT_START', toSqlYmd(body.CONTRACT_START)],
          ['CONTRACT_END', toSqlYmd(body.CONTRACT_END)],
          ['RENEWABLE_CONTRACT', toSqlYmd(body.RENEWABLE_CONTRACT)],
        ];
        for (const [col, ymd] of datePairs) {
          if (ymd) {
            await Employee.sequelize.query(
              `UPDATE [EMPLOYEE1] SET [${col}] = CONVERT(date, :val, 23) WHERE [ID_EMP] = :id`,
              { replacements: { val: ymd, id: newId } }
            );
          }
        }
      }

      res.status(201).json({ message: "Employee created successfully", ID_EMP: newId });
    } catch (err) {
      console.error("Create Employee Error:", err);
      res.status(500).json({ message: "Error creating Employee" });
    }
  },
];

// UPDATE existing Employee
exports.update = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;
    const body = req.body || {};
    const { NAME } = body;

    if (!NAME || String(NAME).trim() === "") {
      return res.status(400).json({
        message: "'NAME' must be provided",
      });
    }

    try {
      // Minimal existence check
      const exists = await Employee.findOne({ where: { ID_EMP }, attributes: ["ID_EMP"], raw: true });
      if (!exists) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Build dynamic payload of allowed fields present in body
      const allowed = Object.keys(Employee.rawAttributes);
      const payload = {};
      for (const key of allowed) {
        if (typeof body[key] !== "undefined") {
          payload[key] = body[key] === "" ? null : body[key];
        }
      }
      payload.NAME = String(NAME).trim();

      const idEmp = Number(ID_EMP);
      if (!Number.isFinite(idEmp)) {
        return res.status(400).json({ message: "Invalid employee id" });
      }

      // Do not allow client to set audit columns on update
      delete payload.CREATED_AT;
      delete payload.UPDATED_AT;

      // Coerce types
      if (typeof payload.PS !== "undefined" && payload.PS !== null)
        payload.PS = Number(payload.PS);
      if (typeof payload.STATE !== "undefined") payload.STATE = !!payload.STATE;
      if (typeof payload.IS_FOREINGHT !== "undefined")
        payload.IS_FOREINGHT = !!payload.IS_FOREINGHT;
      if (typeof payload.FINGERPRINT_NEEDED !== "undefined")
        payload.FINGERPRINT_NEEDED = !!payload.FINGERPRINT_NEEDED;

      // Normalize TIME-only fields (expect 'HH:mm' or 'HH:mm:ss')
      const normalizeTime = (val) => {
        if (val == null || val === "") return null;
        const s = String(val).trim();
        if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
        if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
        return null;
      };
      if (Object.prototype.hasOwnProperty.call(payload, "T_START")) {
        payload.T_START = normalizeTime(payload.T_START);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "T_END")) {
        payload.T_END = normalizeTime(payload.T_END);
      }

      // Parse to a safe 'YYYY-MM-DD' string (supports 'DD-MM-YYYY' and 'YYYY-MM-DD')
      const toSqlYmd = (val) => {
        if (!val) return null;
        let s = String(val).slice(0, 10);
        if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split("-");
          s = `${yyyy}-${mm}-${dd}`;
        }
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      };

      // Separate date and non-date fields; treat PLACE_OF_BIRTH as text
      const dateFields = [
        "DATE_OF_BIRTH",
        "CONTRACT_START",
        "CONTRACT_END",
        "RENEWABLE_CONTRACT",
      ];
      const dateUpdates = {};
      for (const field of dateFields) {
        if (
          Object.prototype.hasOwnProperty.call(payload, field) &&
          payload[field] !== null &&
          payload[field] !== undefined &&
          String(payload[field]).trim() !== ""
        ) {
          const ymd = toSqlYmd(payload[field]);
          if (ymd) dateUpdates[field] = ymd;
        }
        if (field in payload) delete payload[field];
      }

      // Handle image: if PICTURE_URL is a data URL, move to PICTURE (BLOB) and clear URL column
      if (
        typeof payload.PICTURE_URL === "string" &&
        payload.PICTURE_URL.startsWith("data:image")
      ) {
        const idx = payload.PICTURE_URL.indexOf(",");
        const b64 = idx >= 0 ? payload.PICTURE_URL.slice(idx + 1) : payload.PICTURE_URL;
        try {
          payload.PICTURE = Buffer.from(b64, "base64");
          payload.PICTURE_URL = null;
        } catch (e) {
          if (payload.PICTURE_URL.length > 500)
            payload.PICTURE_URL = payload.PICTURE_URL.slice(0, 500);
        }
      } else if (
        typeof payload.PICTURE_URL === "string" &&
        payload.PICTURE_URL.length > 500
      ) {
        payload.PICTURE_URL = payload.PICTURE_URL.slice(0, 500);
      }

      if (
        Object.prototype.hasOwnProperty.call(payload, "PICTURE") &&
        !Buffer.isBuffer(payload.PICTURE)
      ) {
        delete payload.PICTURE;
      }

      // Reuse detected DB columns across controller methods after normalization
      const existingCols = await getExistingEmpColumns(Employee.sequelize);
      const filteredPayload = {};
      for (const [attr, val] of Object.entries(payload)) {
        const colName = attributeToDbColumn(attr);
        if (existingCols.has(String(colName).toUpperCase())) {
          filteredPayload[attr] = val;
        }
      }

      if (Object.keys(filteredPayload).length) {
        await Employee.update(filteredPayload, { where: { ID_EMP: idEmp } });
      }

      for (const [col, ymd] of Object.entries(dateUpdates)) {
        const dbCol = attributeToDbColumn(col);
        if (!existingCols.has(String(dbCol).toUpperCase())) continue;
        try {
          await Employee.sequelize.query(
            `UPDATE [EMPLOYEE1] SET [${dbCol}] = CONVERT(date, :val, 23) WHERE [ID_EMP] = :id`,
            { replacements: { val: ymd, id: idEmp } }
          );
        } catch (e) {
          console.warn(
            `Date update failed for ${dbCol} with value ${ymd}:`,
            e?.parent?.message || e?.message
          );
        }
      }

      res.status(200).json({ message: "Employee updated successfully" });
    } catch (err) {
      console.error("Update Employee Error:", err);
      res.status(500).json({ message: "Error updating Employee" });
    }
  },
];

// DELETE Employee
exports.delete = [
  verifyToken,
  async (req, res) => {
    const { ID_EMP } = req.params;

    try {
      const exists = await Employee.findOne({ where: { ID_EMP }, attributes: ["ID_EMP"], raw: true });
      if (!exists) {
        return res.status(404).json({ message: "Employee not found" });
      }
      await Employee.destroy({ where: { ID_EMP } });
      res.status(200).json({ message: "Employee deleted successfully" });
    } catch (err) {
      console.error("Delete Employee Error:", err);
      res.status(500).json({ message: "Error deleting Employee" });
    }
  },
];