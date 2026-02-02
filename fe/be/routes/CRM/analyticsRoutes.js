const express = require('express');
const router = express.Router();
const { Op, fn, col, literal, Sequelize } = require('sequelize');

const Invoice = require('../../models/sales/Invoice');
const Purchase = require('../../models/sales/Purchase');

function toDateISO(d) {
  try { return new Date(d).toISOString().slice(0,10); } catch { return null; }
}
function parseRange(qs = {}) {
  const now = new Date();
  const to = qs.to ? toDateISO(qs.to) : now.toISOString().slice(0,10);
  const fromDate = qs.from ? new Date(qs.from) : new Date(now);
  if (!qs.from) fromDate.setDate(now.getDate() - 30);
  const from = toDateISO(fromDate);
  return { from, to };
}
function branchName(ps) {
  const n = Number(ps);
  switch (n) {
    case 0: return 'Headquarters';
    case 1: return 'Jraba Mall';
    case 2: return 'Jraba Main';
    case 3: return 'Ben Ashour';
    case 4: return 'P4';
    default: return `PS${isNaN(n) ? '' : n}`;
  }
}
function priceExpr() {
  // Prefer discounted, else regular
  return fn('COALESCE', col('prix_vente_remise'), col('prix_vente'));
}

// GET /api/analytics/sales/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/sales/summary', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query || {});
    const where = { d_time: { [Op.gte]: new Date(from), [Op.lte]: new Date(`${to}T23:59:59Z`) } };

    const row = await Invoice.findOne({
      attributes: [[fn('SUM', priceExpr()), 'total']],
      where,
      raw: true,
    });
    const total = Number(row?.total || 0);

    // MoM: previous equal-length window
    const lenDays = Math.max(1, Math.ceil((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / (1000*60*60*24)));
    const prevEnd = new Date(`${from}T00:00:00Z`); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - (lenDays - 1));
    const rowPrev = await Invoice.findOne({
      attributes: [[fn('SUM', priceExpr()), 'total']],
      where: { d_time: { [Op.gte]: prevStart, [Op.lte]: new Date(`${toDateISO(prevEnd)}T23:59:59Z`) } },
      raw: true,
    });
    const prev = Number(rowPrev?.total || 0);
    const mom = prev ? (total - prev) / prev : null;

    // YoY: same window last year
    const fromY = new Date(`${from}T00:00:00Z`); fromY.setFullYear(fromY.getFullYear() - 1);
    const toY = new Date(`${to}T23:59:59Z`); toY.setFullYear(toY.getFullYear() - 1);
    const rowY = await Invoice.findOne({
      attributes: [[fn('SUM', priceExpr()), 'total']],
      where: { d_time: { [Op.gte]: fromY, [Op.lte]: toY } },
      raw: true,
    });
    const lastYear = Number(rowY?.total || 0);
    const yoy = lastYear ? (total - lastYear) / lastYear : null;

    res.json({ total, mom, yoy, window: { from, to } });
  } catch (e) {
    console.error('analytics summary failed:', e);
    res.status(500).json({ error: 'summary failed' });
  }
});

// GET /api/analytics/sales/top-items?from&to&limit=5
router.get('/sales/top-items', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query || {});
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 5)));
    const where = { d_time: { [Op.gte]: new Date(from), [Op.lte]: new Date(`${to}T23:59:59Z`) } };

    const rows = await Invoice.findAll({
      attributes: [
        'id_art',
        [fn('SUM', priceExpr()), 'total'],
        [fn('COUNT', col('id_art')), 'count'],
      ],
      where,
      group: ['id_art'],
      order: [[literal('total'), 'DESC']],
      limit,
      raw: true,
    });

    // attach labels from Purchase
    const ids = rows.map(r => r.id_art).filter(Boolean);
    let labels = {};
    if (ids.length) {
      const ps = await Purchase.findAll({
        where: { id_fact: { [Op.in]: ids } },
        attributes: ['id_fact','CODE_EXTERNAL','Model','Design_art','Serial_Number'],
        raw: true,
      });
      for (const p of ps) {
        labels[p.id_fact] = p.Model || p.Design_art || p.Serial_Number || p.CODE_EXTERNAL || `Item ${p.id_fact}`;
      }
    }

    const items = rows.map(r => ({
      id: r.id_art,
      label: labels[r.id_art] || `Item ${r.id_art}`,
      total: Number(r.total || 0),
      count: Number(r.count || 0),
    }));
    res.json({ items });
  } catch (e) {
    console.error('analytics top-items failed:', e);
    res.status(500).json({ error: 'top-items failed' });
  }
});

// GET /api/analytics/sales/by-branch?from&to
router.get('/sales/by-branch', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query || {});
    const where = { d_time: { [Op.gte]: new Date(from), [Op.lte]: new Date(`${to}T23:59:59Z`) } };

    const rows = await Invoice.findAll({
      attributes: [
        'ps',
        [fn('SUM', priceExpr()), 'total'],
        [fn('COUNT', col('ps')), 'count'],
      ],
      where,
      group: ['ps'],
      order: [[literal('total'), 'DESC']],
      raw: true,
    });

    const branches = rows.map(r => ({
      ps: r.ps,
      branch: branchName(r.ps),
      total: Number(r.total || 0),
      count: Number(r.count || 0),
    }));
    res.json({ branches });
  } catch (e) {
    console.error('analytics by-branch failed:', e);
    res.status(500).json({ error: 'by-branch failed' });
  }
});

module.exports = router;
