const jwt = require('jsonwebtoken');
const { Op, fn } = require('sequelize');

// Models
const Invoice = require('../../models/sales/Invoice');
const Purchase = require('../../models/sales/Purchase');
const Supplier = require('../../models/sales/Supplier');
const Revenue = require('../../models/Finance/Revenue');
const Expenses = require('../../models/Finance/Expenses');

// Associations (light, only when needed)
Purchase.belongsTo(Supplier, { foreignKey: 'client' });
Supplier.hasMany(Purchase, { foreignKey: 'client', useJunctionTable: false });

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Authorization header missing' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

function toDateOnly(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

// GET /analytics/sales/summary?from=&to=&ps=
exports.salesSummary = [auth, async (req, res) => {
  try {
    const { from, to, ps } = req.query;
    const where = { id_art: { [Op.gt]: 0 } };
    if (ps && ps !== '-1') where.ps = ps;
    if (from || to) {
      where.date_fact = {};
      if (from) where.date_fact[Op.gte] = new Date(from);
      if (to) where.date_fact[Op.lte] = new Date(to);
    }
    const rows = await Invoice.findAll({ where });

    let totalNet = 0, totalGross = 0, count = 0;
    const byDay = new Map();
    const byPos = new Map();
    const byChannel = new Map();
    const bySource = new Map();
    const wholesaleRetail = new Map();

    for (const r of rows) {
      const net = Number(r.total_remise_final_lyd ?? r.amount_lyd ?? 0);
      const gross = Number(r.amount_lyd ?? 0);
      const dateKey = toDateOnly(r.date_fact) || 'unknown';
      const pos = r.ps ?? 'NA';
      const channel = r.mode_fact || 'NA';
      const source = r.SourceMark || 'NA';
      const wr = r.IS_WHOLE_SALE ? 'wholesale' : 'retail';

      totalNet += net;
      totalGross += gross;
      count += 1;

      byDay.set(dateKey, (byDay.get(dateKey) || 0) + net);
      byPos.set(String(pos), (byPos.get(String(pos)) || 0) + net);
      byChannel.set(channel, (byChannel.get(channel) || 0) + net);
      bySource.set(source, (bySource.get(source) || 0) + net);
      wholesaleRetail.set(wr, (wholesaleRetail.get(wr) || 0) + net);
    }

    const avgTicket = count ? totalNet / count : 0;
    const resp = {
      kpis: {
        total_net_lyd: totalNet,
        total_gross_lyd: totalGross,
        receipts_count: count,
        avg_ticket: avgTicket,
      },
      by_day: [...byDay.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, net_lyd]) => ({ date, net_lyd })),
      by_pos: [...byPos.entries()].map(([ps, net_lyd]) => ({ ps, net_lyd })),
      by_channel: [...byChannel.entries()].map(([mode_fact, net_lyd]) => ({ mode_fact, net_lyd })),
      by_source: [...bySource.entries()].map(([SourceMark, net_lyd]) => ({ SourceMark, net_lyd })),
      wholesale_retail: [...wholesaleRetail.entries()].map(([type, net_lyd]) => ({ type, net_lyd })),
    };
    return res.json(resp);
  } catch (e) {
    console.error('salesSummary error', e);
    return res.status(500).json({ message: 'Error computing sales summary' });
  }
}];

// GET /analytics/finance/revexp?from=&to=&ps=
exports.financeRevExp = [auth, async (req, res) => {
  try {
    const { from, to, ps } = req.query;

    const revWhere = {};
    if (ps && ps !== '-1') revWhere.ps = ps;
    if (from || to) {
      revWhere.date = {};
      if (from) revWhere.date[Op.gte] = new Date(from);
      if (to) revWhere.date[Op.lte] = new Date(to);
    }
    const expWhere = {};
    if (ps && ps !== '-1') expWhere.PS = ps;
    if (from || to) {
      expWhere.date_trandsaction = {};
      if (from) expWhere.date_trandsaction[Op.gte] = new Date(from);
      if (to) expWhere.date_trandsaction[Op.lte] = new Date(to);
    }

    const [revs, exps] = await Promise.all([
      Revenue.findAll({ where: revWhere }),
      Expenses.findAll({ where: expWhere }),
    ]);

    let revenueLyd = 0, expensesLyd = 0;
    const byDay = new Map();
    const byCurrency = new Map();

    for (const r of revs) {
      const d = toDateOnly(r.date) || 'unknown';
      const curr = r.currency || 'NA';
      const amtCurr = Number(r.montant_currency ?? r.montant ?? 0);
      const rate = Number(r.rate ?? 1);
      const lyd = amtCurr * rate;
      revenueLyd += lyd;
      const entry = byDay.get(d) || { revenue_lyd: 0, expenses_lyd: 0 };
      entry.revenue_lyd += lyd;
      byDay.set(d, entry);

      const currRow = byCurrency.get(curr) || { currency: curr, revenue_curr: 0, revenue_lyd: 0, expenses_curr: 0, expenses_lyd: 0 };
      currRow.revenue_curr += amtCurr;
      currRow.revenue_lyd += lyd;
      byCurrency.set(curr, currRow);
    }

    for (const e of exps) {
      const d = toDateOnly(e.date_trandsaction) || 'unknown';
      const lyd = Number(e.montant_net ?? e.montant ?? 0);
      expensesLyd += lyd;
      const entry = byDay.get(d) || { revenue_lyd: 0, expenses_lyd: 0 };
      entry.expenses_lyd += lyd;
      byDay.set(d, entry);

      const currRow = byCurrency.get('LYD') || { currency: 'LYD', revenue_curr: 0, revenue_lyd: 0, expenses_curr: 0, expenses_lyd: 0 };
      currRow.expenses_lyd += lyd;
      byCurrency.set('LYD', currRow);
    }

    return res.json({
      totals: { revenue_lyd: revenueLyd, expenses_lyd: expensesLyd, net_profit_lyd: revenueLyd - expensesLyd },
      by_day: [...byDay.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      by_currency: [...byCurrency.values()],
    });
  } catch (e) {
    console.error('financeRevExp error', e);
    return res.status(500).json({ message: 'Error computing finance rev/exp' });
  }
}];

// GET /analytics/purchases/summary?from=&to=&ps=&type_supplier=
exports.purchasesSummary = [auth, async (req, res) => {
  try {
    const { from, to, ps, type_supplier } = req.query;
    const where = { is_selled: false }; // Only unsold items
    if (ps && ps !== '-1' && ps !== 'undefined') where.ps = ps;

    if (from || to) {
      where.date_fact = {};
      if (from) where.date_fact[Op.gte] = new Date(from);
      if (to) where.date_fact[Op.lte] = new Date(to);
    }
    const include = [{ model: Supplier, attributes: ['id_client', 'client_name', 'TYPE_SUPPLIER'] }];
    if (type_supplier) {
      include[0].where = { TYPE_SUPPLIER: { [Op.like]: `%${type_supplier}%` } };
    }

    const rows = await Purchase.findAll({ where, include });

    let costLyd = 0, itemsCount = 0;
    const byDay = new Map();
    const bySupplier = new Map();
    const priceTrend = new Map();

    for (const r of rows) {
      const d = toDateOnly(r.date_fact) || 'unknown';
      const cost = Number(r.Cost_Lyd ?? 0);
      costLyd += cost;
      itemsCount += Number(r.qty ?? 0);

      byDay.set(d, (byDay.get(d) || 0) + cost);

      const supplierName = r.Supplier?.client_name || 'Unknown';
      bySupplier.set(supplierName, (bySupplier.get(supplierName) || 0) + cost);

      const curr = Number(r.Cost_Currency ?? 0);
      const prev = priceTrend.get(d) || { sum_lyd: 0, sum_curr: 0, n: 0 };
      prev.sum_lyd += cost;
      prev.sum_curr += curr;
      prev.n += 1;
      priceTrend.set(d, prev);
    }

    const priceTrendArr = [...priceTrend.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, v]) => ({
      date,
      avg_cost_lyd: v.n ? v.sum_lyd / v.n : 0,
      avg_cost_currency: v.n ? v.sum_curr / v.n : 0,
    }));

    return res.json({
      totals: { cost_lyd: costLyd, items_count: itemsCount },
      by_day: [...byDay.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, cost_lyd]) => ({ date, cost_lyd })),
      by_supplier: [...bySupplier.entries()].map(([supplier, cost_lyd]) => ({ supplier, cost_lyd })),
      price_trend: priceTrendArr,
    });
  } catch (e) {
    console.error('purchasesSummary error', e);
    return res.status(500).json({ message: 'Error computing purchases summary' });
  }
}];

// GET /analytics/inventory/summary?ps=&type_supplier=
exports.inventorySummary = [auth, async (req, res) => {
  try {
    const { ps, type_supplier } = req.query;
    const sequelize = Purchase.sequelize;
    
    // Build base where conditions
    const where = { is_selled: false }; // Only unsold items
    if (ps && ps !== '-1') where.ps = ps;

    const include = [
      { 
        model: Supplier, 
        attributes: ['TYPE_SUPPLIER'],
        required: false,
        ...(type_supplier && {
          where: { 
            TYPE_SUPPLIER: { [Op.like]: `%${type_supplier}%` } 
          }
        })
      }
    ];

    // First, get all purchases
    const purchases = await Purchase.findAll({
      where,
      include,
      attributes: [
        'id_art',
        'qty',
        'Cost_Lyd',
        'Design_art',
        'ps',
        [sequelize.col('Supplier.TYPE_SUPPLIER'), 'supplier_type']
      ]
    });

    // Get sold quantities
    const soldQuantities = await sequelize.query(`
      SELECT id_art, SUM(qty) as sold_qty 
      FROM Facture 
      WHERE id_art IS NOT NULL
      GROUP BY id_art
    `, { type: sequelize.QueryTypes.SELECT });

    const soldMap = new Map(soldQuantities.map(item => [
      item.id_art, 
      Number(item.sold_qty) || 0
    ]));

    // Calculate available quantities
    let itemsOnHand = 0;
    let itemsAvailable = 0;
    let totalValue = 0;
    const byType = new Map();

    for (const p of purchases) {
      const purchaseQty = Number(p.qty) || 0;
      const soldQty = soldMap.get(p.id_art) || 0;
      const availableQty = Math.max(0, purchaseQty - soldQty);
      
      if (availableQty > 0) {
        itemsOnHand++;
        itemsAvailable += availableQty;
        totalValue += availableQty * (Number(p.Cost_Lyd) || 0);
        
        const type = p.get('supplier_type') || 'Unknown';
        byType.set(type, (byType.get(type) || 0) + availableQty);
      }
    }

    return res.json({
      kpis: { 
        items_on_hand: itemsOnHand, 
        items_available: itemsAvailable,
        total_value_lyd: totalValue,
        low_stock_count: 0 // Can be implemented with a threshold
      },
      by_type_supplier: [...byType.entries()].map(([type_supplier, items]) => ({ 
        type_supplier, 
        items 
      }))
    });
  } catch (e) {
    console.error('inventorySummary error', e);
    return res.status(500).json({ 
      message: 'Error computing inventory summary',
      error: e.message 
    });
  }
}];
