const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3001';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || process.env.SMTP_FROM?.trim() || 'support@vsp-voip.com';
const APP_NAME = 'VSP-VOIP';

function wrapText(body) {
  return [
    body,
    '',
    '—',
    APP_NAME,
    SUPPORT_EMAIL ? `Support: ${SUPPORT_EMAIL}` : null,
  ].filter(Boolean).join('\n');
}

function welcomeEmail({ name, email, tenantName, loginUrl, temporaryPassword }) {
  const login = loginUrl || `${WEB_ORIGIN}/login`;
  const subject = `Welcome to ${APP_NAME} — ${tenantName}`;
  const text = wrapText([
    `Hi ${name || 'there'},`,
    '',
    `Your ${APP_NAME} account for ${tenantName} is ready.`,
    '',
    `Sign in: ${login}`,
    `Email: ${email}`,
    temporaryPassword ? `Temporary password: ${temporaryPassword}` : null,
    temporaryPassword ? 'Please change your password after first login.' : null,
    '',
    'Next steps:',
    '1. Sign in to the portal',
    '2. Purchase or assign phone numbers',
    '3. Add team members under Settings → Team',
    '4. Configure call routing under Greeting / Call routing',
  ].filter(Boolean).join('\n'));

  return { subject, text };
}

function passwordResetEmail({ name, resetUrl }) {
  const subject = `${APP_NAME} password reset`;
  const text = wrapText([
    `Hi ${name || 'there'},`,
    '',
    'We received a request to reset your password.',
    '',
    `Reset link (expires in 1 hour):`,
    resetUrl,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n'));

  return { subject, text };
}

function invoiceEmail({ invoice }) {
  return {
    subject: invoice.subject,
    text: wrapText(invoice.body),
  };
}

function paymentReceiptEmail({ tenantName, order, phoneNumbers, amount, currency = 'USD' }) {
  const numbers = Array.isArray(phoneNumbers) ? phoneNumbers : [];
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
  const subject = `${APP_NAME} payment receipt — ${tenantName}`;
  const text = wrapText([
    `Payment received for ${tenantName}.`,
    '',
    `Order: ${order.id}`,
    `Amount: ${formatted}`,
    numbers.length ? `Numbers: ${numbers.join(', ')}` : null,
    '',
    'Your numbers will appear in the portal shortly if not already assigned.',
    `View orders: ${WEB_ORIGIN}/settings/orders/${order.id}`,
  ].filter(Boolean).join('\n'));

  return { subject, text };
}

function recurringPaymentReceiptEmail({ tenantName, invoiceId, amountDue, currency = 'USD' }) {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((Number(amountDue) || 0) / 100);
  const subject = `${APP_NAME} subscription payment — ${tenantName}`;
  const text = wrapText([
    `Subscription payment processed for ${tenantName}.`,
    '',
    `Invoice: ${invoiceId}`,
    `Amount: ${formatted}`,
    '',
    `Manage billing: ${WEB_ORIGIN}/settings/subscription`,
  ].join('\n'));

  return { subject, text };
}

module.exports = {
  welcomeEmail,
  passwordResetEmail,
  invoiceEmail,
  paymentReceiptEmail,
  recurringPaymentReceiptEmail,
  WEB_ORIGIN,
  SUPPORT_EMAIL,
};
