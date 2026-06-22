const { sendEmail, isSmtpConfigured } = require('./mailer');
const {
  welcomeEmail,
  passwordResetEmail,
  invoiceEmail,
  paymentReceiptEmail,
  recurringPaymentReceiptEmail,
  WEB_ORIGIN,
} = require('./emailTemplates');
const { storeResetToken } = require('./passwordReset');
const { logger } = require('./logger');

async function sendWelcomeEmail({ name, email, tenantName, temporaryPassword }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'SMTP not configured' };
  }
  const { subject, text } = welcomeEmail({
    name,
    email,
    tenantName,
    loginUrl: `${WEB_ORIGIN}/login`,
    temporaryPassword,
  });
  return sendEmail({ to: email, subject, text });
}

async function sendPasswordResetEmail({ user }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'SMTP not configured' };
  }
  const token = await storeResetToken(user.id, user.email);
  const resetUrl = `${WEB_ORIGIN}/reset-password?token=${token}`;
  const { subject, text } = passwordResetEmail({ name: user.name, resetUrl });
  const result = await sendEmail({ to: user.email, subject, text });
  logger.info('password_reset_email', { userId: user.id, sent: result.sent });
  return result;
}

async function sendInvoiceEmail({ to, invoice }) {
  if (!isSmtpConfigured()) {
    return { sent: false, reason: 'SMTP not configured' };
  }
  const { subject, text } = invoiceEmail({ invoice });
  return sendEmail({ to, subject, text });
}

async function sendPaymentReceiptEmail({ to, tenantName, order, phoneNumbers, amount, currency }) {
  if (!isSmtpConfigured() || !to) {
    return { sent: false, reason: 'SMTP not configured or no recipient' };
  }
  const { subject, text } = paymentReceiptEmail({
    tenantName,
    order,
    phoneNumbers,
    amount,
    currency,
  });
  const result = await sendEmail({ to, subject, text });
  logger.info('payment_receipt_email', { orderId: order.id, sent: result.sent });
  return result;
}

async function sendRecurringPaymentReceiptEmail({ to, tenantName, invoiceId, amountDue, currency }) {
  if (!isSmtpConfigured() || !to) {
    return { sent: false, reason: 'SMTP not configured or no recipient' };
  }
  const { subject, text } = recurringPaymentReceiptEmail({
    tenantName,
    invoiceId,
    amountDue,
    currency,
  });
  return sendEmail({ to, subject, text });
}

async function resolveTenantAdminEmail(prisma, tenantId) {
  const admin = await prisma.user.findFirst({
    where: { tenantId, role: 'TENANT_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  return admin?.email || null;
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendPaymentReceiptEmail,
  sendRecurringPaymentReceiptEmail,
  resolveTenantAdminEmail,
};
