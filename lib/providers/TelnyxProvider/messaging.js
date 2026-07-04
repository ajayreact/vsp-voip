/**
 * TelnyxProvider/messaging — thin re-export wrapper over lib/messaging/telnyxClient.js.
 */

const telnyxClient = require('../../messaging/telnyxClient');

module.exports = {
  sendTelnyxMessage: telnyxClient.sendTelnyxMessage,
  fetchTelnyxMessage: telnyxClient.fetchTelnyxMessage,
  extractTelnyxDeliveryStatus: telnyxClient.extractTelnyxDeliveryStatus,
  extractTelnyxDeliveryErrors: telnyxClient.extractTelnyxDeliveryErrors,
};
