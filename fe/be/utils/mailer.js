const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || "mail.gaja.ly",
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: {
      user: process.env.MAIL_USER || "info@gaja.ly",
      pass: process.env.MAIL_PASS || "P@$$word123",
    },
    tls: { rejectUnauthorized: false },
  });
}

module.exports = { createTransporter };
