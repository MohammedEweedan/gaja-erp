// controllers/HR/catalogController.js
const Level = require('../../models/hr/Level');
const Specialite = require('../../models/hr/Specialite');
const TSCode = require('../../models/hr/TSCode');
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

exports.getLevels = [ verifyToken, async (_req, res) => {
  try { res.json(await Level.findAll({ order: [['desig_m3', 'ASC']] })); }
  catch (err) { console.error(err); res.status(500).json({ message: 'Error fetching levels' }); }
}];

// Robust resolver: detect the actual table+schema by looking for the expected columns,
// then query it directly to avoid 500s due to table name differences.
exports.getSpecialite = [ verifyToken, async (_req, res) => {
  try {
    // 1) If an explicit override is provided (SPECIALITE_TABLE), prefer it
    const full = process.env.SPECIALITE_TABLE || '';
    if (full) {
      let query;
      if (full.includes('.')) {
        const [sch, tbl] = full.split('.', 2);
        query = `SELECT id_specialite, nom_specialite FROM [${sch}].[${tbl}] ORDER BY nom_specialite ASC`;
      } else {
        query = `SELECT id_specialite, nom_specialite FROM [${full}] ORDER BY nom_specialite ASC`;
      }
      const [rows] = await Specialite.sequelize.query(query);
      return res.json(rows);
    }

    // 2) Auto-detect a table that has both columns: id_specialite and nom_specialite
    const [cands] = await Specialite.sequelize.query(`
      SELECT TOP 1 c.TABLE_SCHEMA, c.TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.COLUMN_NAME IN ('id_specialite','nom_specialite')
      GROUP BY c.TABLE_SCHEMA, c.TABLE_NAME
      HAVING COUNT(DISTINCT CASE WHEN c.COLUMN_NAME IN ('id_specialite','nom_specialite') THEN c.COLUMN_NAME END) = 2
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME
    `);

    if (!Array.isArray(cands) || cands.length === 0) {
      return res.status(500).json({ message: 'Specialities table not found (no table with columns id_specialite & nom_specialite)' });
    }

    const { TABLE_SCHEMA, TABLE_NAME } = cands[0];
    const query = `SELECT id_specialite, nom_specialite FROM [${TABLE_SCHEMA}].[${TABLE_NAME}] ORDER BY nom_specialite ASC`;
    const [rows] = await Specialite.sequelize.query(query);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching specialities dynamically:', err);
    return res.status(500).json({ message: 'Error fetching specialities', error: err.message });
  }
}];

// Create a new speciality (uses same resolver logic; expects body { nom_specialite })
exports.createSpecialite = [ verifyToken, async (req, res) => {
  try {
    const { nom_specialite } = req.body || {};
    if (!nom_specialite || String(nom_specialite).trim() === '') {
      return res.status(400).json({ message: 'nom_specialite is required' });
    }

    const full = process.env.SPECIALITE_TABLE || '';
    let schema, table;
    if (full) {
      if (full.includes('.')) {
        const [sch, tbl] = full.split('.', 2);
        schema = sch; table = tbl;
      } else {
        table = full;
      }
    } else {
      const [cands] = await Specialite.sequelize.query(`
        SELECT TOP 1 c.TABLE_SCHEMA, c.TABLE_NAME
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.COLUMN_NAME IN ('id_specialite','nom_specialite')
        GROUP BY c.TABLE_SCHEMA, c.TABLE_NAME
        HAVING COUNT(DISTINCT CASE WHEN c.COLUMN_NAME IN ('id_specialite','nom_specialite') THEN c.COLUMN_NAME END) = 2
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME
      `);
      if (!Array.isArray(cands) || cands.length === 0) {
        return res.status(500).json({ message: 'Specialities table not found (no table with columns id_specialite & nom_specialite)' });
      }
      schema = cands[0].TABLE_SCHEMA; table = cands[0].TABLE_NAME;
    }

    const qualified = schema ? `[${schema}].[${table}]` : `[${table}]`;
    const insertQuery = `INSERT INTO ${qualified} (nom_specialite) OUTPUT INSERTED.id_specialite, INSERTED.nom_specialite VALUES (@nom)`;
    const [rows] = await Specialite.sequelize.query(insertQuery, {
      replacements: { nom: String(nom_specialite).trim() },
      type: Specialite.sequelize.QueryTypes.INSERT
    });

    // In MSSQL with OUTPUT, sequelize returns as SELECT results; fall back to read-back
    if (Array.isArray(rows) && rows.length > 0 && rows[0].id_specialite) {
      return res.status(201).json(rows[0]);
    }
    // Fallback: read last inserted
    const [fresh] = await Specialite.sequelize.query(`SELECT TOP 1 id_specialite, nom_specialite FROM ${qualified} WHERE nom_specialite = @nom ORDER BY id_specialite DESC`, {
      replacements: { nom: String(nom_specialite).trim() }
    });
    return res.status(201).json(Array.isArray(fresh) && fresh.length ? fresh[0] : { nom_specialite });
  } catch (err) {
    console.error('Error creating speciality:', err);
    return res.status(500).json({ message: 'Error creating speciality', error: err.message });
  }
}];

exports.getLeaveCodes = [ verifyToken, async (_req, res) => {
  try { res.json(await TSCode.findAll({ order: [['int_can', 'ASC']] })); }
  catch (err) { console.error(err); res.status(500).json({ message: 'Error fetching leave codes' }); }
}];

// Debug endpoint to list tables matching "Spec%" to identify actual table name/schema
exports.debugListSpecialitiesTables = [ verifyToken, async (_req, res) => {
  try {
    const [rows] = await Specialite.sequelize.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME LIKE '%Spec%'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error listing tables:', err);
    res.status(500).json({ message: 'Error listing tables', error: err.message });
  }
}];

// Debug endpoint: find table by columns id_specialite & nom_specialite
exports.debugFindSpecialiteTableByColumns = [ verifyToken, async (_req, res) => {
  try {
    const [rows] = await Specialite.sequelize.query(`
      SELECT c.TABLE_SCHEMA, c.TABLE_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      GROUP BY c.TABLE_SCHEMA, c.TABLE_NAME
      HAVING SUM(CASE WHEN c.COLUMN_NAME = 'id_specialite' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN c.COLUMN_NAME = 'nom_specialite' THEN 1 ELSE 0 END) > 0
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error finding table by columns:', err);
    res.status(500).json({ message: 'Error finding table by columns', error: err.message });
  }
}];
