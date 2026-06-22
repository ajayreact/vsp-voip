function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);
}

function getBankDetails(platform, gateway) {
  if (gateway) {
    return {
      bankName: gateway.bankName || '',
      accountName: gateway.bankAccountName || '',
      accountNumber: gateway.bankAccountNumber || '',
      routingNumber: gateway.bankIfscSwift || '',
      swiftCode: gateway.bankIfscSwift || '',
      branch: gateway.bankBranch || '',
      instructions: gateway.bankPaymentInstructions || '',
      contactEmail: platform?.invoiceContactEmail || '',
    };
  }
  return {
    bankName: platform.bankName || '',
    accountName: platform.bankAccountName || '',
    accountNumber: platform.bankAccountNumber || '',
    routingNumber: platform.bankRoutingNumber || '',
    swiftCode: platform.bankSwiftCode || '',
    branch: '',
    instructions: platform.bankPaymentInstructions || '',
    contactEmail: platform.invoiceContactEmail || '',
  };
}

function isManualPaymentConfigured(platform, gateway) {
  if (gateway) {
    return Boolean(
      gateway.bankAccountNumber
      || gateway.bankIfscSwift
      || gateway.bankPaymentInstructions
      || gateway.bankName,
    );
  }
  const bank = getBankDetails(platform);
  return Boolean(
    bank.accountNumber || bank.routingNumber || bank.instructions || bank.bankName,
  );
}

function buildInvoiceNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VSP-${stamp}-${suffix}`;
}

function buildInvoiceContent({ order, tenant, platform, pricing, gateway }) {
  const bank = getBankDetails(platform, gateway);
  const phoneNumbers = Array.isArray(order.phoneNumbers) ? order.phoneNumbers : [];
  const invoiceNumber = order.invoiceNumber || buildInvoiceNumber();
  const dueAmount = formatMoney(order.totalCharged, order.currency || 'USD');
  const recurring = formatMoney(pricing?.recurringMonthly ?? order.carrierMonthly, order.currency || 'USD');

  const lines = [
    'VSP-VOIP — Phone Number Invoice',
    '================================',
    '',
    `Invoice: ${invoiceNumber}`,
    `Order ID: ${order.id}`,
    `Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-US')}`,
    `Bill to: ${tenant.name}`,
    '',
    'Numbers ordered:',
    ...phoneNumbers.map((n) => `  • ${n}`),
    '',
    'Amount due (first payment):',
    `  Carrier upfront + first month: ${formatMoney(Number(order.carrierUpfront) + Number(order.carrierMonthly))}`,
    `  VSP-VOIP platform fees:        ${formatMoney(order.platformFee)}`,
    `  TOTAL DUE NOW:                 ${dueAmount}`,
    `  Then recurring monthly:        ${recurring}/mo`,
    '',
    'Bank transfer details:',
    bank.bankName ? `  Bank:            ${bank.bankName}` : null,
    bank.branch ? `  Branch:          ${bank.branch}` : null,
    bank.accountName ? `  Account name:    ${bank.accountName}` : null,
    bank.accountNumber ? `  Account number:  ${bank.accountNumber}` : null,
    bank.routingNumber ? `  IFSC / Routing:  ${bank.routingNumber}` : null,
    bank.swiftCode && bank.swiftCode !== bank.routingNumber ? `  SWIFT / BIC:     ${bank.swiftCode}` : null,
    bank.instructions ? `\nPayment instructions:\n${bank.instructions}` : null,
    '',
    `Please include invoice reference "${invoiceNumber}" in your bank transfer memo.`,
    bank.contactEmail ? `Questions: ${bank.contactEmail}` : null,
    '',
    'After we confirm your payment, your numbers will be purchased and assigned to your account.',
  ].filter((line) => line != null);

  const subject = `VSP-VOIP Invoice ${invoiceNumber} — ${tenant.name}`;
  const body = lines.join('\n');

  return {
    invoiceNumber,
    subject,
    body,
    htmlBody: lines.map((l) => l.replace(/</g, '&lt;')).join('<br>\n'),
    dueAmount,
    recurringAmount: recurring,
    phoneNumbers,
  };
}

function buildMailtoLink({ to, invoice }) {
  if (!to) return null;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(invoice.subject)}&body=${encodeURIComponent(invoice.body)}`;
}

module.exports = {
  formatMoney,
  getBankDetails,
  isManualPaymentConfigured,
  buildInvoiceNumber,
  buildInvoiceContent,
  buildMailtoLink,
};
