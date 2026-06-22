const { logger } = require('./logger');

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || '',
    from: process.env.SMTP_FROM?.trim() || process.env.INVOICE_FROM_EMAIL?.trim() || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS?.trim() || '',
  };
}

function isSmtpConfigured() {
  const { host, from } = getSmtpConfig();
  return Boolean(host && from);
}

function createTransporter() {
  const { host, port, secure, user, pass } = getSmtpConfig();
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

const { isProduction } = require('./env');

async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    return { configured: false, connected: false, optional: !isProduction() };
  }
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { configured: true, connected: true };
  } catch (error) {
    return { configured: true, connected: false, error: error.message };
  }
}

async function sendEmail({ to, subject, text, html }) {
  const { from } = getSmtpConfig();

  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'SMTP not configured. Set SMTP_HOST and SMTP_FROM in server .env' };
  }

  if (!to) {
    return { sent: false, reason: 'No recipient email address' };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || undefined,
    });
    return { sent: true };
  } catch (error) {
    logger.error('smtp_send_failed', { to, subject, error: error.message });
    return { sent: false, reason: error.message || 'Email send failed' };
  }
}

module.exports = {
  sendEmail,
  isSmtpConfigured,
  verifySmtpConnection,
  getSmtpConfig,
};
