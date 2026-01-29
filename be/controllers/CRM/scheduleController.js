const express = require('express');
const router = express.Router();

// Simple in-memory schedule; replace with real PS schedule source
// Days: 0=Sun...6=Sat (libya Fri off typically)
const DEFAULT_TZ = process.env.TZ || 'Africa/Tripoli';
const DEFAULT_PS_ID = Number(process.env.DEFAULT_PS_ID || 1);
const DEFAULT_WORKING = {
  // 0=Sunday ... 6=Saturday (Fri off = 5)
  0: { open: '10:00', close: '18:00' },
  1: { open: '10:00', close: '18:00' },
  2: { open: '10:00', close: '18:00' },
  3: { open: '10:00', close: '18:00' },
  4: { open: '10:00', close: '18:00' },
  5: null, // Friday closed
  6: { open: '10:00', close: '16:00' },
};
const HOLIDAYS = new Set((process.env.HOLIDAYS || '').split(',').filter(Boolean)); // YYYY-MM-DD

function parseTimeToMinutes(t) {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

router.get('/working-hours', (req, res) => {
  const psId = Number(req.query.psId || DEFAULT_PS_ID);
  // TODO: fetch real PS-based schedule; for now return default
  res.json({ psId, tz: DEFAULT_TZ, working: DEFAULT_WORKING });
});

router.get('/availability', (req, res) => {
  try {
    const psId = Number(req.query.psId || DEFAULT_PS_ID);
    const date = String(req.query.date || '').slice(0, 10); // YYYY-MM-DD
    const slotMin = Number(process.env.SLOT_MINUTES || 30);
    if (!date) return res.status(400).json({ error: 'date required YYYY-MM-DD' });
    if (HOLIDAYS.has(date)) return res.json({ psId, date, slots: [] });

    const d = new Date(date + 'T00:00:00');
    if (isNaN(d)) return res.status(400).json({ error: 'invalid date' });
    // JS: 0=Sun ... 6=Sat
    const dow = d.getDay();
    const rule = DEFAULT_WORKING[dow];
    if (!rule) return res.json({ psId, date, slots: [] });

    const now = new Date();
    const openM = parseTimeToMinutes(rule.open);
    const closeM = parseTimeToMinutes(rule.close);

    const slots = [];
    for (let m = openM; m + slotMin <= closeM; m += slotMin) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const iso = `${date}T${hh}:${mm}:00`;
      const slotDate = new Date(iso);
      // Exclude past slots for today
      if (d.toDateString() === now.toDateString() && slotDate < now) continue;
      slots.push(iso);
    }
    res.json({ psId, date, tz: DEFAULT_TZ, slots });
  } catch (e) {
    res.status(500).json({ error: 'failed to compute availability' });
  }
});

module.exports = router;
