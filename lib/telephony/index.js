/**
 * Desk Phone Call Engine V2 module barrel.
 */
const constants = require('./constants');
const PayloadNormalizer = require('./PayloadNormalizer');
const CallerResolver = require('./CallerResolver');
const DestinationResolver = require('./DestinationResolver');
const DeskCallRouter = require('./DeskCallRouter');
const ExtensionCallService = require('./ExtensionCallService');
const MobileCallService = require('./MobileCallService');
const PstnCallService = require('./PstnCallService');
const CallBridgeService = require('./CallBridgeService');
const CallStateManager = require('./CallStateManager');

module.exports = {
  ...constants,
  ...PayloadNormalizer,
  ...CallerResolver,
  ...DestinationResolver,
  ...DeskCallRouter,
  ExtensionCallService,
  MobileCallService,
  PstnCallService,
  CallBridgeService,
  CallStateManager,
};
