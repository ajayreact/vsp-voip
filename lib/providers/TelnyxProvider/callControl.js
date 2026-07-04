/**
 * TelnyxProvider/callControl — thin re-export wrapper.
 *
 * `executeCommand` delegates to the existing, unmodified
 * lib/telephony-v3/Executor/telnyxAdapter.js — the same adapter
 * commandExecutor.js already calls today. Wiring commandExecutor through
 * ProviderResolver -> TelnyxProvider therefore produces byte-identical
 * behavior to the current (pre-multi-provider) code path.
 */

const telnyxAdapter = require('../../telephony-v3/Executor/telnyxAdapter');
const telnyxCallControl = require('../../telnyxCallControl');

module.exports = {
  executeCommand: telnyxAdapter.executeCommand,
  telnyxCallControl,
};
