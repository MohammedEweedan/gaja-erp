const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const dataDir = path.join(__dirname, '../../data');
const filePath = path.join(dataDir, 'appointments.json');
function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]', 'utf8');
}
function readAll() {
  ensureStore();
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]'); } catch { return []; }
}
function writeAll(list) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
}

router.post('/', async (req, res) => {
  try {
    const { customer = {}, datetime, location, notes, channel } = req.body || {};
    if (!datetime) return res.status(400).json({ error: 'datetime required' });
    if (!customer?.phone && !customer?.email) return res.status(400).json({ error: 'contact required' });
    const id = `apt_${Date.now()}`;
    const all = readAll();
    const rec = { id, status: 'created', customer, datetime, location, notes, channel, createdAt: new Date().toISOString() };
    all.push(rec);
    writeAll(all);
    res.json(rec);
  } catch (e) {
    res.status(500).json({ error: 'failed to create appointment' });
  }
});

module.exports = router;
