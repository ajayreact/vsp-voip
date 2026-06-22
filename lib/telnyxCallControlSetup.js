const axios = require('axios');
const { loadPlatformSettings } = require('./platformSettings');
const { getApiPublicUrl } = require('./telnyxRecordingSetup');
const { telnyxApiRequest } = require('./telnyxCallControl');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function findTelnyxPhoneNumberId(normalizedNumber) {
  if (!TELNYX_API_KEY || !normalizedNumber) return null;
  const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
    },
    params: { 'filter[phone_number]': normalizedNumber },
    timeout: 15000,
  });
  return response.data?.data?.[0] ?? null;
}

function getCallControlApplicationId(platform) {
  return platform?.telnyxCallControlApplicationId
    || process.env.TELNYX_CALL_CONTROL_APP_ID?.trim()
    || null;
}

async function getCallControlApplication(applicationId) {
  if (!applicationId) return null;
  return telnyxApiRequest('get', `/call_control_applications/${encodeURIComponent(applicationId)}`);
}

async function ensureCallControlApplicationWebhook(applicationId, webhookUrl) {
  if (!applicationId || !webhookUrl) {
    return { updated: false, reason: 'missing_app_or_url' };
  }

  const app = await getCallControlApplication(applicationId);
  if (!app) {
    return { updated: false, reason: 'app_not_found' };
  }

  if (app.webhook_event_url === webhookUrl) {
    return { updated: false, reason: 'already_configured', webhookUrl, applicationName: app.application_name };
  }

  await telnyxApiRequest('patch', `/call_control_applications/${encodeURIComponent(applicationId)}`, {
    webhook_event_url: webhookUrl,
    webhook_api_version: '2',
    active: true,
  });

  return { updated: true, webhookUrl, applicationName: app.application_name };
}

async function getCallControlSetupStatus(prisma) {
  const apiPublicUrl = getApiPublicUrl();
  const port = process.env.PORT || 3000;
  const webhookBase = apiPublicUrl || `http://localhost:${port}`;
  const callControlWebhookUrl = `${webhookBase}/webhook/call-control`;

  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const applicationId = getCallControlApplicationId(platform);
  let applicationWebhookUrl = null;
  let applicationName = null;

  if (applicationId) {
    try {
      const app = await getCallControlApplication(applicationId);
      applicationWebhookUrl = app?.webhook_event_url || null;
      applicationName = app?.application_name || null;
    } catch (error) {
      return {
        applicationId,
        callControlWebhookUrl,
        webhooksReachable: Boolean(apiPublicUrl),
        applicationWebhookConfigured: false,
        message: error.message,
      };
    }
  }

  let message = 'Call Control inbound is not configured.';
  if (!applicationId) {
    message = 'Set TELNYX_CALL_CONTROL_APP_ID or add Call Control Application ID in Admin → Platform settings.';
  } else if (!apiPublicUrl) {
    message = 'Set API_PUBLIC_URL so Telnyx can POST inbound Call Control events.';
  } else if (applicationWebhookUrl !== callControlWebhookUrl) {
    message = 'Restart the API after setting API_PUBLIC_URL to auto-update the Call Control webhook.';
  } else {
    message = 'Call Control inbound routing is configured. Assign purchased numbers to this application.';
  }

  return {
    applicationId,
    applicationName,
    callControlWebhookUrl,
    webhooksReachable: Boolean(apiPublicUrl),
    applicationWebhookConfigured: applicationWebhookUrl === callControlWebhookUrl,
    applicationWebhookUrl,
    message,
  };
}

async function ensureTelnyxCallControlSetup(prisma) {
  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const applicationId = getCallControlApplicationId(platform);
  if (!applicationId) {
    return { webhook: null, numbers: null };
  }

  const apiPublicUrl = getApiPublicUrl();
  const webhookUrl = apiPublicUrl ? `${apiPublicUrl}/webhook/call-control` : null;
  const webhook = webhookUrl
    ? await ensureCallControlApplicationWebhook(applicationId, webhookUrl)
    : null;

  // Always assign tenant numbers to Call Control so mobile/WebRTC inbound works,
  // even when API_PUBLIC_URL is not set yet (webhook sync needs a public URL).
  const numbers = prisma
    ? await syncPhoneNumbersToCallControlApp(prisma, applicationId)
    : null;

  return { webhook, numbers };
}

async function syncPhoneNumbersToCallControlApp(prisma, applicationId) {
  if (!applicationId || !prisma) {
    return { updated: 0, skipped: 0 };
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: { isActive: { not: false } },
    select: { number: true, tenantId: true },
  });

  let updated = 0;
  let skipped = 0;
  let appRouting = 0;

  for (const row of numbers) {
    try {
      const phone = await findTelnyxPhoneNumberId(row.number);
      if (!phone?.id) {
        skipped += 1;
        continue;
      }
      if (phone.connection_id === applicationId) {
        skipped += 1;
        continue;
      }
      await telnyxApiRequest('patch', `/phone_numbers/${encodeURIComponent(phone.id)}`, {
        connection_id: applicationId,
      });
      updated += 1;

      const greeting = row.tenantId
        ? await prisma.greeting.findUnique({ where: { tenantId: row.tenantId } })
        : null;
      const phoneRecord = await prisma.phoneNumber.findUnique({
        where: { number: row.number },
        select: { routingType: true, assignedUserId: true },
      });
      const { requiresCallControlRouting } = require('./inboundRouting');
      if (requiresCallControlRouting(greeting || {}, phoneRecord)) {
        appRouting += 1;
      }
      console.log(`   ↳ Assigned ${row.number} to Call Control app`);
    } catch (error) {
      skipped += 1;
      console.warn(`   ↳ Could not assign ${row.number} to Call Control: ${error.message}`);
    }
  }

  return { updated, skipped, total: numbers.length, appRouting };
}

module.exports = {
  getCallControlApplicationId,
  getCallControlSetupStatus,
  ensureTelnyxCallControlSetup,
  ensureCallControlApplicationWebhook,
  syncPhoneNumbersToCallControlApp,
};
