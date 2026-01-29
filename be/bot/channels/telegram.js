const express = require('express');
const { handleText } = require('../llm/orchestrator');
const router = express.Router();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_API = TELEGRAM_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}` : '';

router.post('/webhook', express.json(), async (req, res) => {
  try {
    const update = req.body;
    const chatId = update?.message?.chat?.id;
    const text = update?.message?.text || '';
    if (!chatId) return res.sendStatus(200);

    const out = await handleText(String(text || ''), String(chatId), 'telegram');

    if (TG_API) {
      await fetch(`${TG_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: out.reply }),
      });
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

module.exports = router;
