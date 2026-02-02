const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const dataDir = path.join(__dirname, '../../data');
const filePath = path.join(dataDir, 'tickets.json');
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
    const { subject, customer = {}, message, channel, consent } = req.body || {};
    if (!subject || !message) return res.status(400).json({ error: 'subject and message required' });
    if (!customer?.phone && !customer?.email) return res.status(400).json({ error: 'contact required' });
    const id = `tkt_${Date.now()}`;
    const all = readAll();
    const rec = { id, status: 'created', subject, customer, message, channel, consent: !!consent, createdAt: new Date().toISOString() };
    all.push(rec);
    writeAll(all);
    res.json(rec);
  } catch (e) {
    res.status(500).json({ error: 'failed to create ticket' });
  }
});

module.exports = router;
