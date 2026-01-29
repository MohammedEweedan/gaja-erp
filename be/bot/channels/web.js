const express = require('express');
const { handleText, applyCtx, getSessionState } = require('../llm/orchestrator');
const router = express.Router();

router.post('/webhook', express.json(), async (req, res) => {
  const { text, sessionId, internal, ctx } = req.body || {};
  try {
    const host = String(req.headers.host || '').toLowerCase();
    const onPublic = /^(www\.gaja\.ly(?::\d+)?|gaja\.ly(?::\d+)?)$/.test(host);
    const empHeader = String(req.headers['x-employee'] || '').toLowerCase() === '1';
    const isEmp = !onPublic && (empHeader || !!internal);
    const channel = isEmp ? 'web-emp' : 'web';
    const sid = String(sessionId || 'web');
    if (ctx && typeof ctx === 'object') applyCtx(sid, ctx);
    const out = await handleText(String(text || ''), sid, channel);
    const ctxOut = getSessionState(sid);
    res.json({ reply: out.reply, images: out.images || [], suggestions: out.suggestions || [], actions: out.actions || [], ctx: ctxOut });
  } catch (e) {
    res.json({ reply: 'صار خلل بسيط، جرّب مرة ثانية.' });
  }
});

module.exports = router;
