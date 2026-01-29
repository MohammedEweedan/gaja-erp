const express = require('express');
const router = express.Router();
const { handleText } = require('../llm/orchestrator');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';
const WABA_TOKEN = process.env.META_WABA_TOKEN || '';

// Verify webhook for Messenger/WhatsApp
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// Helper: send reply to Messenger
async function sendMessenger(recipientId, text) {
  if (!PAGE_TOKEN) return;
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}

// Helper: send reply to WhatsApp (Cloud API)
async function sendWhatsApp(phoneNumberId, to, text) {
  if (!WABA_TOKEN) return;
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WABA_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
}

router.post('/webhook', express.json(), async (req, res) => {
  try {
    const body = req.body;
    // WhatsApp payload
    const waEntry = body?.entry?.[0]?.changes?.[0]?.value;
    if (waEntry?.messages && Array.isArray(waEntry.messages) && waEntry.messages.length) {
      const msg = waEntry.messages[0];
      const from = msg.from; // sender phone
      const text = msg.text?.body || msg.interactive?.nfm_reply?.response_json || '';
      const phoneNumberId = waEntry?.metadata?.phone_number_id;
      if (from && text && phoneNumberId) {
        const out = await handleText(String(text), String(from), 'whatsapp');
        await sendWhatsApp(phoneNumberId, from, out.reply || 'تمام، شن نقدر نعاونك فيه؟');
      }
      return res.sendStatus(200);
    }

    // Messenger payload
    const msEntry = body?.entry?.[0]?.messaging?.[0];
    if (msEntry?.sender?.id && (msEntry?.message?.text || msEntry?.postback?.title)) {
      const senderId = msEntry.sender.id;
      const text = msEntry.message?.text || msEntry.postback?.title || '';
      const out = await handleText(String(text), String(senderId), 'messenger');
      await sendMessenger(senderId, out.reply || 'تمام، شن نقدر نعاونك فيه؟');
      return res.sendStatus(200);
    }

    // Nothing matched
    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(200);
  }
});

module.exports = router;
