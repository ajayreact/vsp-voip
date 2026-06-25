const axios = require('axios');
const { normalizePhoneNumber } = require('./phone');
const { setCachedTenant } = require('./tenantCache');

function telnyxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function findTelnyxPhoneNumberId(normalizedNumber, apiKey) {
  const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
    headers: telnyxHeaders(apiKey),
    params: { 'filter[phone_number]': normalizedNumber },
  });
  return response.data.data?.[0]?.id ?? null;
}

async function assignToConnection(phoneNumberId, connectionId, apiKey) {
  await axios.patch(
    `https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`,
    { connection_id: connectionId },
    { headers: telnyxHeaders(apiKey) },
  );
}

async function assignToMessagingProfile(normalizedNumber, messagingProfileId, apiKey) {
  await axios.patch(
    `https://api.telnyx.com/v2/messaging_phone_numbers/${encodeURIComponent(normalizedNumber)}`,
    { messaging_profile_id: messagingProfileId },
    { headers: telnyxHeaders(apiKey) },
  );
}

async function buyAndAssignNumber({
  phoneNumber,
  tenant,
  prisma,
  apiKey,
  connectionId,
  callControlApplicationId,
  messagingProfileId,
  marginData,
}) {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  if (!normalizedNumber) {
    const error = new Error('Invalid phone number format');
    error.status = 400;
    throw error;
  }

  const existing = await prisma.phoneNumber.findUnique({ where: { number: normalizedNumber } });
  if (existing) {
    if (existing.tenantId && existing.tenantId !== tenant.id) {
      const error = new Error('Number already assigned to another organization');
      error.status = 409;
      throw error;
    }
    if (!existing.tenantId) {
      const { assignDidToTenant } = require('./adminDidManagement');
      const assigned = await assignDidToTenant(prisma, {
        phoneNumberId: existing.id,
        tenantId: tenant.id,
        apiKey,
      });
      return { savedNumber: assigned, alreadyOwned: true, connectionAssigned: false, messagingProfileAssigned: false };
    }
    await setCachedTenant(normalizedNumber, tenant);
    return { savedNumber: existing, alreadyOwned: true, connectionAssigned: false, messagingProfileAssigned: false };
  }

  try {
    await axios.post(
      'https://api.telnyx.com/v2/number_orders',
      { phone_numbers: [{ phone_number: normalizedNumber }] },
      { headers: telnyxHeaders(apiKey) },
    );
  } catch (err) {
    const detail = err.response?.data?.errors?.[0]?.detail || err.message;
    const error = new Error(detail || 'Telnyx rejected the number order');
    error.status = err.response?.status || 500;
    throw error;
  }

  let connectionAssigned = false;
  let messagingProfileAssigned = false;
  const voiceConnectionId = callControlApplicationId || connectionId;
  if (voiceConnectionId || messagingProfileId) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const phoneId = await findTelnyxPhoneNumberId(normalizedNumber, apiKey);
      if (phoneId) {
        if (voiceConnectionId) {
          await assignToConnection(phoneId, voiceConnectionId, apiKey);
          connectionAssigned = true;
        }
        if (messagingProfileId) {
          await assignToMessagingProfile(normalizedNumber, messagingProfileId, apiKey);
          messagingProfileAssigned = true;
        }
        break;
      }
    }
  }

  const savedNumber = await prisma.phoneNumber.create({
    data: {
      number: normalizedNumber,
      tenantId: tenant.id,
      ...(marginData?.orderId ? { orderId: marginData.orderId } : {}),
      ...(marginData?.source ? { source: marginData.source } : {}),
      ...(marginData?.telnyxUpfrontCost != null ? { telnyxUpfrontCost: marginData.telnyxUpfrontCost } : {}),
      ...(marginData?.telnyxMonthlyCost != null ? { telnyxMonthlyCost: marginData.telnyxMonthlyCost } : {}),
      ...(marginData?.platformSetupFee != null ? { platformSetupFee: marginData.platformSetupFee } : {}),
      ...(marginData?.platformFirstMonthFee != null ? { platformFirstMonthFee: marginData.platformFirstMonthFee } : {}),
      ...(marginData?.platformMonthlyFee != null ? { platformMonthlyFee: marginData.platformMonthlyFee } : {}),
      ...(marginData?.customerPriceTotal != null ? { customerPriceTotal: marginData.customerPriceTotal } : {}),
      ...(marginData?.customerPriceMonthly != null ? { customerPriceMonthly: marginData.customerPriceMonthly } : {}),
      ...(marginData?.grossProfitUpfront != null ? { grossProfitUpfront: marginData.grossProfitUpfront } : {}),
      ...(marginData?.grossProfitMonthly != null ? { grossProfitMonthly: marginData.grossProfitMonthly } : {}),
      ...(marginData?.carrierMonthly != null ? { carrierMonthly: marginData.carrierMonthly } : {}),
      ...(marginData?.platformMonthly != null ? { platformMonthly: marginData.platformMonthly } : {}),
      ...(marginData?.tenantMonthlyTotal != null ? { tenantMonthlyTotal: marginData.tenantMonthlyTotal } : {}),
    },
  });
  await setCachedTenant(normalizedNumber, tenant);

  return {
    savedNumber,
    alreadyOwned: false,
    connectionAssigned,
    messagingProfileAssigned,
  };
}

module.exports = {
  buyAndAssignNumber,
  findTelnyxPhoneNumberId,
  verifyTelnyxNumberOwnership,
};

async function verifyTelnyxNumberOwnership(normalizedNumber, apiKey) {
  if (!apiKey?.trim()) {
    const error = new Error('Telnyx API key is not configured');
    error.status = 503;
    throw error;
  }
  const phoneId = await findTelnyxPhoneNumberId(normalizedNumber, apiKey);
  if (!phoneId) {
    const error = new Error('Number not found in Telnyx account. Purchase it on Telnyx before assigning.');
    error.status = 404;
    throw error;
  }
  return phoneId;
}
