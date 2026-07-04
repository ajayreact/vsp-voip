/**
 * TelnyxProvider/webhookVerify — thin re-export wrapper over lib/telnyxVerify.js
 * (Ed25519 signature verification via the `telnyx` package's webhook helper).
 */

const telnyxVerify = require('../../telnyxVerify');

module.exports = {
  parseTelnyxFormBody: telnyxVerify.parseTelnyxFormBody,
  parseTelnyxJsonBody: telnyxVerify.parseTelnyxJsonBody,
  parseTelnyxWebhookBody: telnyxVerify.parseTelnyxWebhookBody,
  verifyTelnyxWebhookMiddleware: telnyxVerify.verifyTelnyxWebhookMiddleware,
  webhookStrictEnabled: telnyxVerify.webhookStrictEnabled,
};
