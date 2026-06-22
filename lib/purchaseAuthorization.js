/**
 * Revenue protection: tenants must pay before Telnyx purchase.
 * Only Super Admin may use direct purchase APIs (with billing controls).
 */

function assertDirectPurchaseAllowed(user) {
  if (!user || user.role !== 'SUPER_ADMIN') {
    const error = new Error(
      'Direct number purchase is disabled. Complete checkout with Stripe or an approved bank transfer order.',
    );
    error.status = 403;
    error.code = 'DIRECT_PURCHASE_FORBIDDEN';
    throw error;
  }
}

function assertBankFulfillmentApproved(order) {
  if (order.paymentMethod !== 'MANUAL_BANK') return;

  if (order.paymentReviewStatus !== 'APPROVED') {
    const error = new Error(
      'Bank transfer payment must be approved before numbers can be purchased from Telnyx.',
    );
    error.status = 403;
    error.code = 'BANK_PAYMENT_NOT_APPROVED';
    throw error;
  }
}

module.exports = {
  assertDirectPurchaseAllowed,
  assertBankFulfillmentApproved,
};
