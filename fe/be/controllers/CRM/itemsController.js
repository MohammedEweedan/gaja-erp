const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Purchase = require('../../models/sales/Purchase'); // ACHAT
const Invoice = require('../../models/sales/Invoice');   // Facture
const Supplier = require('../../models/sales/Supplier'); // Fournisseur

// Ensure association for filtering
try { Purchase.belongsTo(Supplier, { foreignKey: 'client' }); } catch {}

const API_BASE = process.env.API_BASE_URL || 'http://localhost:9000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const ROOT_DIR = path.dirname(require.main.filename || process.cwd());
const WATCH_PIC_DIR = path.join(ROOT_DIR, 'uploads', 'WatchPic');
const WOP_DIR = path.join(ROOT_DIR, 'uploads', 'WOpurchase', 'upload-attachment');

function toNumber(n) { const x = Number(n); return Number.isFinite(x) ? x : null; }
function priceLyd(row) {
  const spc = toNumber(row?.Selling_Price_Currency);
  const rate = toNumber(row?.Selling_Rate);
  if (spc != null && rate != null) return +(spc * rate).toFixed(2);
  const costLyd = toNumber(row?.Cost_Lyd);
  return costLyd != null ? +(+costLyd).toFixed(2) : null;
}

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim().toLowerCase();
    if (!q) return res.json({ items: [] });

    const where = {
      [Op.or]: [
        { CODE_EXTERNAL: { [Op.like]: `%${q}%` } },
        { Model: { [Op.like]: `%${q}%` } },
        { Serial_Number: { [Op.like]: `%${q}%` } },
        { Design_art: { [Op.like]: `%${q}%` } },
        { Original_Invoice: { [Op.like]: `%${q}%` } },
      ],
    };
    if (/^\d+$/.test(q)) {
      // allow direct id/code matches
      const n = Number(q);
      where[Op.or].push({ id_fact: n });
      where[Op.or].push({ id_art: n });
      where[Op.or].push({ num_fact: n });
      where[Op.or].push({ CODE_EXTERNAL: { [Op.like]: `%${q}%` } });
      where[Op.or].push({ Model: { [Op.like]: `%${q}%` } });
      where[Op.or].push({ Serial_Number: { [Op.like]: `%${q}%` } });
    }

    

    const include = [];
    if (type) {
      const map = { gold: 'gold', diamond: 'diamond', watch: 'watch' };
      const key = map[type];
      if (key) {
        include.push({ model: Supplier, attributes: ['TYPE_SUPPLIER'], where: { TYPE_SUPPLIER: { [Op.like]: `%${key}%` } }, required: false });
      }
    }

    

    const results = await Purchase.findAll({
      where,
      limit: 20,
      order: [['id_fact', 'DESC']],
      attributes: [
        'id_fact','CODE_EXTERNAL','Design_art','Model','Serial_Number','CURRENCY','ps',
        'Selling_Price_Currency','Selling_Rate','Cost_Lyd','is_selled','qty','Full_qty'
      ],
      include,
    });

    let items = results.map((r) => {
      const name = r.Model || r.Design_art || r.Serial_Number || r.CODE_EXTERNAL || `Item ${r.id_fact}`;
      return {
        id: r.id_fact,
        sku: r.CODE_EXTERNAL,
        name,
        model: r.Model,
        serial: r.Serial_Number,
        currency: r.CURRENCY || 'LYD',
        price_lyd: priceLyd(r),
        ps: r.ps,
        available: !r.is_selled,
      };
    });

    // Fallback: if nothing found and q is numeric, try Invoice lookup to backtrack id_art
    if (!items.length && /^\d+$/.test(q)) {
      const n = Number(q);
      const invoices = await Invoice.findAll({
        where: { [Op.or]: [{ num_fact: n }, { id_fact: n }, { id_art: n }] },
        attributes: ['id_art'],
        limit: 10,
        order: [['d_time','DESC']],
      });
      const arts = [...new Set(invoices.map(i => i.id_art).filter(Boolean))];
      if (arts.length) {
        const p2 = await Purchase.findAll({
          where: { id_art: { [Op.in]: arts } },
          limit: 20,
          order: [['id_fact','DESC']],
          attributes: [
            'id_fact','CODE_EXTERNAL','Design_art','Model','Serial_Number','CURRENCY','ps',
            'Selling_Price_Currency','Selling_Rate','Cost_Lyd','is_selled','qty','Full_qty'
          ],
        });
        items = p2.map((r) => {
          const name = r.Model || r.Design_art || r.Serial_Number || r.CODE_EXTERNAL || `Item ${r.id_fact}`;
          return {
            id: r.id_fact,
            sku: r.CODE_EXTERNAL,
            name,
            model: r.Model,
            serial: r.Serial_Number,
            currency: r.CURRENCY || 'LYD',
            price_lyd: priceLyd(r),
            ps: r.ps,
            available: !r.is_selled,
          };
        });
      }
    }

    // Final fallback: watches via Inventory + WOpurchases when searching by id_fact (e.g., 40064)
    if (!items.length && /^\d+$/.test(q) && (!type || type === 'watch' || type === 'watches')) {
      try {
        const ps = Number(req.query.ps || 1);
        const invRes = await fetch(`${API_BASE}/Inventory/allActive?ps=${ps}&type_supplier=watches`);
        if (invRes.ok) {
          const invList = await invRes.json();
          const inv = (Array.isArray(invList) ? invList : []).find((x) => String(x?.id_fact) === String(q));
          if (inv) {
            const code = String(inv.CODE_EXTERNAL || '');
            const sufMatch = code.match(/-(\s*)(\d{4,6})\s*$/);
            const suffix = sufMatch ? sufMatch[2] : null;
            const woRes = await fetch(`${API_BASE}/WOpurchases/all`);
            let priceLyd = null, wp = null;
            if (woRes.ok) {
              const wos = await woRes.json();
              const arr = Array.isArray(wos) ? wos : [];
              wp = arr.find((w) => {
                if (suffix && String(w?.reference_number || '').includes(suffix)) return true;
                if (inv.Serial_Number && String(w?.serial_number || '') === String(inv.Serial_Number)) return true;
                if (inv.Design_art && String(w?.model || '').toLowerCase().includes(String(inv.Design_art).toLowerCase())) return true;
                return false;
              });
              if (wp && wp.sale_price) priceLyd = Number(wp.sale_price);
            }
            if (priceLyd == null) {
              const spc = toNumber(inv.Selling_Price_Currency);
              const rate = toNumber(inv.Selling_Rate);
              if (spc != null && rate != null && rate > 0) priceLyd = +(spc * rate).toFixed(2);
            }
            items = [{
              id: inv.id_fact,
              sku: inv.CODE_EXTERNAL || inv.reference_number || null,
              name: inv.Design_art || (wp?.model) || 'Watch',
              model: inv.Model || wp?.model || null,
              serial: inv.Serial_Number || wp?.serial_number || null,
              currency: 'LYD',
              price_lyd: priceLyd,
              ps: inv.ps,
              available: inv.is_selled === false,
            }];
          }
        }
      } catch {}
    }

    res.json({ items });
  } catch (e) {
    console.error('items/search failed:', e);
    res.status(500).json({ error: 'search failed' });
  }
});

// List images for a watch purchase (wpId) and return signed URLs usable by /images route
router.get('/images', async (req, res) => {
  try {
    const wpId = Number(req.query.wpId);
    if (!Number.isFinite(wpId)) return res.json({ urls: [] });
    const base = `${req.protocol}://${req.get('host')}`;
    // Try WatchPic first (signed)
    const dirWatch = path.join(WATCH_PIC_DIR, String(wpId));
    if (fs.existsSync(dirWatch)) {
      const files = fs.readdirSync(dirWatch).filter(f => !f.startsWith('.')).slice(0, 12);
      if (files.length) {
        const token = jwt.sign({ sub: 'chatbot', scope: 'images', wpId }, JWT_SECRET, { expiresIn: '10m' });
        const urls = files.map(f => `${base}/images/${wpId}/${encodeURIComponent(f)}?token=${encodeURIComponent(token)}`);
        return res.json({ urls });
      }
    }
    // Fallback: WOpurchase static files (unsigned)
    const dirWop = path.join(WOP_DIR, String(wpId));
    if (fs.existsSync(dirWop)) {
      const files = fs.readdirSync(dirWop).filter(f => !f.startsWith('.')).slice(0, 12);
      if (files.length) {
        const urls = files.map(f => `${base}/uploads/WOpurchase/upload-attachment/${wpId}/${encodeURIComponent(f)}`);
        return res.json({ urls });
      }
    }
    return res.json({ urls: [] });
  } catch (e) {
    return res.json({ urls: [] });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id must be numeric' });

    let row = await Purchase.findByPk(id);
    if (!row) {
      // Watch fallback: search Inventory across common ps values
      try {
        const psList = [1,2,0,3,4];
        let inv = null;
        for (const ps of psList) {
          const invRes = await fetch(`${API_BASE}/Inventory/allActive?ps=${ps}&type_supplier=watches`);
          if (!invRes.ok) continue;
          const invList = await invRes.json();
          inv = (Array.isArray(invList) ? invList : []).find((x) => String(x?.id_fact) === String(id));
          if (inv) break;
        }
        if (inv) {
          // Try to match WOpurchases
          const code = String(inv.CODE_EXTERNAL || '');
          const sufMatch = code.match(/-(\s*)(\d{4,6})\s*$/);
          const suffix = sufMatch ? sufMatch[2] : null;
          let wp = null;
          try {
            const woRes = await fetch(`${API_BASE}/WOpurchases/all`);
            if (woRes.ok) {
              const wos = await woRes.json();
              const arr = Array.isArray(wos) ? wos : [];
              wp = arr.find((w) => {
                if (suffix && String(w?.reference_number || '').includes(suffix)) return true;
                if (inv.Serial_Number && String(w?.serial_number || '') === String(inv.Serial_Number)) return true;
                if (inv.Design_art && String(w?.model || '').toLowerCase().includes(String(inv.Design_art).toLowerCase())) return true;
                return false;
              }) || null;
            }
          } catch {}

          // Compose item-like response
          const base = `${req.protocol}://${req.get('host')}`;
          const dir = path.join(WATCH_PIC_DIR, String(id));
          const hasDir = fs.existsSync(dir);
          const files = hasDir ? fs.readdirSync(dir).filter(f => !f.startsWith('.')).slice(0, 12) : [];
          const token = jwt.sign({ sub: 'chatbot', scope: 'images', wpId: id }, JWT_SECRET, { expiresIn: '10m' });
          const images = files.map(f => `${base}/images/${id}/${encodeURIComponent(f)}?token=${encodeURIComponent(token)}`);

          const spc = toNumber(inv.Selling_Price_Currency);
          const rate = toNumber(inv.Selling_Rate);
          const priceFromInv = (spc != null && rate != null && rate > 0) ? +(spc * rate).toFixed(2) : null;
          const priceFromWp = wp && wp.sale_price ? Number(wp.sale_price) : null;

          const item = {
            id: inv.id_fact,
            sku: inv.CODE_EXTERNAL || wp?.reference_number || null,
            name: inv.Design_art || wp?.model || 'Watch',
            model: inv.Model || wp?.model || null,
            serial: inv.Serial_Number || wp?.serial_number || null,
            currency: 'LYD',
            price_lyd: priceFromWp ?? priceFromInv,
            ps: inv.ps,
            available: inv.is_selled === false,
            attributes: {
              reference_number: wp?.reference_number || null,
              warranty: wp?.warranty || null,
              retail_price: wp?.retail_price || null,
              sale_price: wp?.sale_price || null,
            },
            images,
          };
          return res.json({ item });
        }
      } catch {}
      return res.status(404).json({ error: 'not found' });
    }

    const latestInvoice = await Invoice.findOne({
      where: { id_art: id },
      order: [['d_time', 'DESC']],
      attributes: ['id_fact','d_time','prix_vente','prix_vente_remise','ps']
    });

    const base = `${req.protocol}://${req.get('host')}`;
    // Try WatchPic first
    const dirWatch = path.join(WATCH_PIC_DIR, String(row.id_fact));
    const filesWatch = fs.existsSync(dirWatch) ? fs.readdirSync(dirWatch).filter(f => !f.startsWith('.')).slice(0, 12) : [];
    let images = [];
    if (filesWatch.length) {
      const token = jwt.sign({ sub: 'chatbot', scope: 'images', wpId: row.id_fact }, JWT_SECRET, { expiresIn: '10m' });
      images = filesWatch.map(f => `${base}/images/${row.id_fact}/${encodeURIComponent(f)}?token=${encodeURIComponent(token)}`);
    } else {
      // Fallback WOpurchase static
      const dirWop = path.join(WOP_DIR, String(row.id_fact));
      const filesWop = fs.existsSync(dirWop) ? fs.readdirSync(dirWop).filter(f => !f.startsWith('.')).slice(0, 12) : [];
      images = filesWop.map(f => `${base}/uploads/WOpurchase/upload-attachment/${row.id_fact}/${encodeURIComponent(f)}`);
    }

    // Compute price with watch fallback if ACHAT price missing/zero
    let finalPrice = priceLyd(row);
    if (!(finalPrice > 0)) {
      try {
        const woRes = await fetch(`${API_BASE}/WOpurchases/all`);
        if (woRes.ok) {
          const wos = await woRes.json();
          const arr = Array.isArray(wos) ? wos : [];
          const code = String(row.CODE_EXTERNAL || '');
          const sufMatch = code.match(/-(\s*)(\d{4,6})\s*$/);
          const suffix = sufMatch ? sufMatch[2] : null;
          const match = arr.find((w) => {
            if (suffix && String(w?.reference_number || '').includes(suffix)) return true;
            if (row.Serial_Number && String(w?.serial_number || '') === String(row.Serial_Number)) return true;
            if (row.Model && String(w?.model || '').toLowerCase().includes(String(row.Model).toLowerCase())) return true;
            if (row.Design_art && String(w?.model || '').toLowerCase().includes(String(row.Design_art).toLowerCase())) return true;
            return false;
          });
          if (match && match.sale_price) finalPrice = Number(match.sale_price);
        }
      } catch {}
    }

    const item = {
      id: row.id_fact,
      sku: row.CODE_EXTERNAL,
      name: row.Model || row.Design_art || row.Serial_Number || row.CODE_EXTERNAL || `Item ${row.id_fact}`,
      model: row.Model,
      serial: row.Serial_Number,
      currency: row.CURRENCY || 'LYD',
      price_lyd: finalPrice,
      cost_lyd: toNumber(row.Cost_Lyd),
      ps: row.ps,
      available: row.is_selled === false,
      attributes: {
        color_gold: row.Color_Gold,
        color_rush: row.Color_Rush,
        making_charge: toNumber(row.MakingCharge),
        shipping_charge: toNumber(row.ShippingCharge),
        weight_g: toNumber(row.cost_g),
      },
      images,
      last_sale: latestInvoice ? {
        invoice_id: latestInvoice.id_fact,
        date: latestInvoice.d_time,
        price_lyd: toNumber(latestInvoice.prix_vente_remise) ?? toNumber(latestInvoice.prix_vente),
        ps: latestInvoice.ps,
      } : null,
    };
    res.json({ item });
  } catch (e) {
    console.error('items/:id failed:', e);
    res.status(500).json({ error: 'fetch failed' });
  }
});

module.exports = router;
