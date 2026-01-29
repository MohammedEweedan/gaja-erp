const { createTransporter } = require('../../utils/mailer');

async function createTicket(payload) {
  const base = process.env.API_BASE_URL || 'http://localhost';
  const res = await fetch(`${base}/api/support/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.API_TOKEN || ''}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`tickets api failed: ${res.status}`);
  const data = await res.json();

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'info@gaja.ly',
      to: process.env.CS_EMAIL || 'info@gaja.ly',
      subject: `[Chatbot] ${payload.subject || 'New ticket'}`,
      text: `Channel: ${payload.channel}\nCustomer: ${JSON.stringify(payload.customer)}\nMessage: ${payload.message}`,
    });
  } catch (_) {}

  return data;
}

module.exports = { createTicket };
