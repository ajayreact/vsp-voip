/**
 * TelnyxProvider/numbers — thin re-export wrapper.
 * Delegates to lib/v3/telnyxNumberService.js, lib/buyNumber.js, lib/numberSearch.js.
 */

const telnyxNumberService = require('../../v3/telnyxNumberService');
const buyNumber = require('../../buyNumber');
const numberSearch = require('../../numberSearch');

module.exports = {
  searchNumbers: telnyxNumberService.searchNumbers,
  purchaseToInventory: telnyxNumberService.purchaseToInventory,
  loadVoiceConnectionIds: telnyxNumberService.loadVoiceConnectionIds,
  getApiKey: telnyxNumberService.getApiKey,
  searchAvailableNumbers: numberSearch.searchAvailableNumbers,
  listAreaCodes: numberSearch.listAreaCodes,
  buyAndAssignNumber: buyNumber.buyAndAssignNumber,
  findTelnyxPhoneNumberId: buyNumber.findTelnyxPhoneNumberId,
  verifyTelnyxNumberOwnership: buyNumber.verifyTelnyxNumberOwnership,
};
