/**
 * V3 Marketplace Service — Super Admin number search, reserve, purchase, release.
 */

const telnyxNumberService = require('./telnyxNumberService');
const numberInventoryService = require('./numberInventoryService');
const { recordDidAssignmentHistory } = require('../adminDidManagement');

async function searchMarketplace(query = {}) {
  return telnyxNumberService.searchNumbers(query);
}

async function reserveMarketplaceNumber(prisma, input, actor = {}) {
  const phoneNumber = String(input.phoneNumber || '').trim();
  if (!phoneNumber) {
    throw Object.assign(new Error('phoneNumber is required'), { status: 400 });
  }
  return numberInventoryService.reserveNumber(prisma, {
    number: phoneNumber,
    country: input.country,
    region: input.region || input.state,
    locality: input.locality,
    capabilities: input.capabilities || input.features,
    monthlyCost: input.monthlyCost,
    reservedByUserId: actor.sub || actor.userId || null,
    notes: input.notes,
  });
}

async function purchaseMarketplaceNumber(prisma, input, actor = {}) {
  const phoneNumber = String(input.phoneNumber || '').trim();
  if (!phoneNumber) {
    throw Object.assign(new Error('phoneNumber is required'), { status: 400 });
  }
  return telnyxNumberService.purchaseToInventory(prisma, {
    phoneNumber,
    purchasedByUserId: actor.sub || actor.userId || null,
    notes: input.notes,
    upfrontCost: input.upfrontCost,
    monthlyCost: input.monthlyCost,
    country: input.country,
    region: input.region || input.state,
    locality: input.locality,
    capabilities: input.capabilities || input.features,
  });
}

async function releaseMarketplaceNumber(prisma, phoneNumberId, actor = {}, { notes } = {}) {
  const item = await numberInventoryService.getInventoryItem(prisma, phoneNumberId);
  if (!item) throw Object.assign(new Error('Phone number not found'), { status: 404 });

  const pending = await numberInventoryService.markReleasePending(prisma, phoneNumberId, { notes });
  const suspended = await numberInventoryService.suspendNumber(prisma, phoneNumberId);

  await recordDidAssignmentHistory(prisma, {
    phoneNumberId,
    number: item.number,
    tenantId: item.tenantId,
    previousTenantId: item.tenantId,
    action: 'V3_RELEASE',
    assignedByUserId: actor.sub || actor.userId || null,
    notes: notes || 'Released from V3 marketplace',
  });

  return { pending, suspended };
}

module.exports = {
  searchMarketplace,
  reserveMarketplaceNumber,
  purchaseMarketplaceNumber,
  releaseMarketplaceNumber,
};
