/**
 * V3 Telnyx Number Service — thin wrapper over existing Telnyx number helpers.
 * Does not duplicate search logic; purchase uses the same Telnyx APIs as buyNumber.js.
 */

const axios = require('axios');
const { normalizePhoneNumber } = require('../phone');
const { searchAvailableNumbers } = require('../numberSearch');
const { findTelnyxPhoneNumberId } = require('../buyNumber');
const { loadPlatformSettings } = require('../platformSettings');
const { getTelnyxConnectionConfig } = require('../telnyxConfig');
const { recordDidAssignmentHistory } = require('../adminDidManagement');
const numberInventoryService = require('./numberInventoryService');

function getApiKey() {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error('Telnyx API key is not configured'), { status: 503 });
  }
  return apiKey;
}

function telnyxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function loadVoiceConnectionIds(prisma) {
  const platform = await loadPlatformSettings(prisma);
  const { connectionId } = getTelnyxConnectionConfig(platform);
  const callControlApplicationId = platform?.telnyxCallControlApplicationId
    || process.env.TELNYX_CALL_CONTROL_APP_ID?.trim()
    || process.env.TELNYX_CALL_CONTROL_APPLICATION_ID?.trim()
    || null;
  const messagingProfileId = platform?.telnyxMessagingProfileId
    || process.env.TELNYX_MESSAGING_PROFILE_ID?.trim()
    || null;
  return {
    voiceConnectionId: callControlApplicationId || connectionId,
    messagingProfileId,
    credentialConnectionId: platform?.telnyxCredentialConnectionId
      || process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim()
      || null,
    callControlApplicationId,
  };
}

async function assignTelnyxConnection(phoneNumberId, connectionId, apiKey) {
  if (!phoneNumberId || !connectionId) return false;
  await axios.patch(
    `https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`,
    { connection_id: connectionId },
    { headers: telnyxHeaders(apiKey) },
  );
  return true;
}

async function searchNumbers(query = {}) {
  return searchAvailableNumbers(query);
}

async function purchaseToInventory(prisma, {
  phoneNumber,
  purchasedByUserId,
  notes,
  upfrontCost,
  monthlyCost,
  country,
  region,
  locality,
  capabilities,
}) {
  const apiKey = getApiKey();
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    throw Object.assign(new Error('Invalid phone number format'), { status: 400 });
  }

  const existing = await prisma.phoneNumber.findUnique({ where: { number: normalized } });
  if (existing) {
    const status = numberInventoryService.deriveInventoryStatus(
      existing,
      await numberInventoryService.loadPortingNumbers(prisma),
    );
    if (status === 'ASSIGNED' || status === 'PORTING') {
      throw Object.assign(new Error('Number already assigned or porting'), { status: 409 });
    }
    if (status === 'AVAILABLE' || status === 'RESERVED') {
      return numberInventoryService.markAvailable(prisma, existing.id, {
        purchasedByUserId,
        notes,
        monthlyCost,
      });
    }
  }

  try {
    await axios.post(
      'https://api.telnyx.com/v2/number_orders',
      { phone_numbers: [{ phone_number: normalized }] },
      { headers: telnyxHeaders(apiKey) },
    );
  } catch (err) {
    const detail = err.response?.data?.errors?.[0]?.detail || err.message;
    throw Object.assign(new Error(detail || 'Telnyx rejected the number order'), {
      status: err.response?.status || 500,
    });
  }

  const { voiceConnectionId } = await loadVoiceConnectionIds(prisma);
  let connectionAssigned = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    const telnyxId = await findTelnyxPhoneNumberId(normalized, apiKey);
    if (telnyxId && voiceConnectionId) {
      await assignTelnyxConnection(telnyxId, voiceConnectionId, apiKey);
      connectionAssigned = true;
      break;
    }
  }

  const label = JSON.stringify({
    country,
    region,
    locality,
    capabilities,
    purchasedByUserId,
    notes,
    purchasedAt: new Date().toISOString(),
    connectionAssigned,
  });

  const saved = existing
    ? await prisma.phoneNumber.update({
      where: { id: existing.id },
      data: {
        tenantId: null,
        isActive: true,
        source: numberInventoryService.V3_SOURCE.AVAILABLE,
        telnyxUpfrontCost: upfrontCost != null ? upfrontCost : undefined,
        telnyxMonthlyCost: monthlyCost != null ? monthlyCost : undefined,
        label,
      },
    })
    : await prisma.phoneNumber.create({
      data: {
        number: normalized,
        tenantId: null,
        isActive: true,
        source: numberInventoryService.V3_SOURCE.AVAILABLE,
        routingType: 'tenant_default',
        telnyxUpfrontCost: upfrontCost != null ? upfrontCost : undefined,
        telnyxMonthlyCost: monthlyCost != null ? monthlyCost : undefined,
        label,
      },
    });

  await recordDidAssignmentHistory(prisma, {
    phoneNumberId: saved.id,
    number: normalized,
    action: 'V3_PURCHASED',
    assignedByUserId: purchasedByUserId,
    notes: notes || 'Purchased to V3 platform inventory',
  });

  const porting = await numberInventoryService.loadPortingNumbers(prisma);
  return numberInventoryService.serializeInventoryRow(
    await prisma.phoneNumber.findUnique({
      where: { id: saved.id },
      include: {
        tenant: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        extension: { select: { id: true, extensionNumber: true, displayName: true, userId: true } },
      },
    }),
    porting,
  );
}

module.exports = {
  searchNumbers,
  purchaseToInventory,
  loadVoiceConnectionIds,
  getApiKey,
};
