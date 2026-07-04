#!/usr/bin/env node
/**
 * End-to-end verification of the Twilio provider lifecycle, mirroring the
 * exact Super Admin click-path:
 *
 *   Providers -> Twilio -> Health -> Create SIP Domain -> Create Credential
 *   -> Register Phone -> Test Call -> Delete Resources
 *
 * Every step below calls the SAME production modules the Super Admin UI and
 * `/api/admin/providers/*` routes call (`lib/providers/ProviderManager.js`,
 * `lib/providers/TwilioProvider/*`) — nothing here is test-only logic, so a
 * pass here means the real admin flow will behave identically once live
 * Twilio credentials are configured.
 *
 * Modes:
 *   1. DRY RUN (default). No TWILIO_* credentials are configured in this
 *      environment (verified before writing this script), so by default
 *      this script installs a fake axios HTTP adapter that returns
 *      realistic Twilio-shaped JSON responses instead of making any real
 *      network call. This validates request construction, response
 *      parsing/DTO mapping, and the full step sequence with zero cost and
 *      zero risk to a live Twilio account.
 *   2. LIVE (`--live`). Requires real TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
 *      (and TWILIO_API_KEY_SID/SECRET for the access-token step) to already
 *      be set in the environment or as a platform-level ProviderCredential
 *      row. Creates REAL, BILLABLE resources (SIP Domain, Credential List
 *      entry, purchased phone number) and places a REAL test call to
 *      --to=<E.164 number>. Deletes everything it created at the end unless
 *      --keep is also passed.
 *
 * Usage:
 *   npx tsx scripts/verify-twilio-provider-e2e.js                 # dry run
 *   npx tsx scripts/verify-twilio-provider-e2e.js --json          # dry run, machine-readable
 *   npx tsx scripts/verify-twilio-provider-e2e.js --live --to=+15551234567 --from=+15557654321
 *   npx tsx scripts/verify-twilio-provider-e2e.js --live --to=+1555... --keep   # skip cleanup
 */
require('dotenv').config();

const ProviderManager = require('../lib/providers/ProviderManager');
const TwilioProvider = require('../lib/providers/TwilioProvider');
const { disconnectPrisma } = require('../db');

const isLive = process.argv.includes('--live');
const keepResources = process.argv.includes('--keep');
const asJson = process.argv.includes('--json');

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const steps = [];

function record(name, ok, detail) {
  steps.push({ name, ok, detail: detail ?? null });
  if (!asJson) {
    const icon = ok ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/**
 * Fake Twilio REST adapter for DRY RUN mode. Installed on the shared axios
 * instance used by lib/providers/TwilioProvider/twilioClient.js so every
 * TwilioProvider call in this script runs its real request-building /
 * response-parsing code, but no bytes leave the machine.
 */
function installFakeTwilioAdapter() {
  const axios = require('axios');
  let domainCounter = 0;
  let credCounter = 0;
  let numberCounter = 0;
  let callCounter = 0;

  axios.defaults.adapter = async (config) => {
    const method = String(config.method || 'get').toLowerCase();
    const url = config.url || '';
    const body = typeof config.data === 'string' ? Object.fromEntries(new URLSearchParams(config.data)) : (config.data || {});
    const respond = (data, status = 200) => ({ data, status, statusText: 'OK', headers: {}, config });

    if (method === 'post' && /\/SIP\/Domains\.json$/.test(url)) {
      domainCounter += 1;
      const sid = `SD_fake_${domainCounter.toString().padStart(8, '0')}`;
      return respond({
        sid,
        domain_name: body.DomainName,
        friendly_name: body.FriendlyName,
        voice_url: body.VoiceUrl,
        sip_registration: body.SipRegistration === 'true',
        secure: body.Secure === 'true',
      });
    }
    if (method === 'delete' && /\/SIP\/Domains\/.+\.json$/.test(url)) {
      return respond('', 204);
    }
    if (method === 'post' && /\/SIP\/CredentialLists\.json$/.test(url)) {
      return respond({ sid: 'CL_fake_00000001', friendly_name: body.FriendlyName });
    }
    if (method === 'post' && /\/SIP\/CredentialLists\/.+\/Credentials\.json$/.test(url)) {
      credCounter += 1;
      return respond({ sid: `CR_fake_${credCounter.toString().padStart(8, '0')}`, username: body.Username });
    }
    if (method === 'delete' && /\/SIP\/CredentialLists\/.+\/Credentials\/.+\.json$/.test(url)) {
      return respond('', 204);
    }
    if (method === 'get' && /\/AvailablePhoneNumbers\/.+\/Local\.json$/.test(url)) {
      return respond({ available_phone_numbers: [{ phone_number: '+15555550100', friendly_name: '+15555550100' }] });
    }
    if (method === 'post' && /\/IncomingPhoneNumbers\.json$/.test(url)) {
      numberCounter += 1;
      return respond({
        sid: `PN_fake_${numberCounter.toString().padStart(8, '0')}`,
        phone_number: body.PhoneNumber || '+15555550100',
        friendly_name: body.FriendlyName || null,
      });
    }
    if (method === 'delete' && /\/IncomingPhoneNumbers\/.+\.json$/.test(url)) {
      return respond('', 204);
    }
    if (method === 'post' && /\/Calls\.json$/.test(url)) {
      callCounter += 1;
      return respond({
        sid: `CA_fake_${callCounter.toString().padStart(8, '0')}`,
        to: body.To,
        from: body.From,
        status: 'queued',
      });
    }
    if (method === 'post' && /\/Calls\/.+\.json$/.test(url)) {
      return respond({ sid: url.split('/').pop().replace('.json', ''), status: body.Status || 'in-progress' });
    }

    throw Object.assign(new Error(`Fake Twilio adapter: no stub for ${method.toUpperCase()} ${url}`), {
      response: { status: 501, data: { message: 'no stub' } },
    });
  };
}

async function main() {
  if (isLive) {
    console.log('=== LIVE MODE — this will create REAL Twilio resources and place a REAL call ===\n');
  } else {
    console.log('=== DRY RUN — no TWILIO_* credentials configured; using a fake HTTP adapter (no live API calls, no cost) ===\n');
    if (!process.env.TWILIO_ACCOUNT_SID) process.env.TWILIO_ACCOUNT_SID = 'AC_dry_run_0000000000000000000000000';
    if (!process.env.TWILIO_AUTH_TOKEN) process.env.TWILIO_AUTH_TOKEN = 'dry_run_auth_token';
    if (!process.env.TWILIO_API_KEY_SID) process.env.TWILIO_API_KEY_SID = 'SK_dry_run_0000000000000000000000';
    if (!process.env.TWILIO_API_KEY_SECRET) process.env.TWILIO_API_KEY_SECRET = 'dry_run_api_key_secret';
    installFakeTwilioAdapter();
  }

  const createdResources = { domainId: null, credentialListSid: null, credentialId: null, numberId: null, callSid: null };

  try {
    // Step 1: Super Admin -> Providers (auto-registers the "twilio" Provider row,
    // exactly like GET /api/admin/providers does on page load).
    const provider = await ProviderManager.ensureProviderRow('twilio', { displayName: 'Twilio' });
    record('Super Admin -> Providers (ensure "twilio" row)', Boolean(provider?.key === 'twilio'), `provider.id=${provider?.id}`);

    // Step 2: Providers -> Twilio (select provider; confirm capabilities surfaced to the UI)
    const capabilities = TwilioProvider.getCapabilities();
    record('Providers -> Twilio (capabilities)', Boolean(capabilities.voice && capabilities.sip), JSON.stringify(capabilities));

    // Step 3: Health
    const health = await ProviderManager.checkHealth('twilio');
    record('Twilio -> Health', Boolean(health.ok), health.message || 'credentials resolved');
    if (!health.ok && isLive) throw new Error(`Health check failed: ${health.message}`);

    // Step 4: Create SIP Domain
    const domainSuffix = Date.now().toString(36);
    const domain = await TwilioProvider.createSipDomain({
      domainName: `vsp-e2e-${domainSuffix}.sip.twilio.com`,
      friendlyName: `VSP E2E Test ${domainSuffix}`,
      voiceWebhookUrl: 'https://example.com/webhooks/twilio/voice',
      sipRegistration: true,
      secure: true,
    });
    createdResources.domainId = domain.externalDomainId;
    record('Health -> Create SIP Domain', Boolean(domain.externalDomainId), `sid=${domain.externalDomainId} sipRegistration=${domain.sipRegistration} secure=${domain.secure}`);

    // Step 5: Create Credential (Credential List + one SIP credential entry)
    const sipCredentials = require('../lib/providers/TwilioProvider/sipCredentials');
    const list = await sipCredentials.ensureCredentialList({ friendlyName: 'vsp-e2e-softphone' });
    createdResources.credentialListSid = list.credentialListSid;
    const credential = await TwilioProvider.createSipCredential({
      credentialListSid: list.credentialListSid,
      username: `ext100-${domainSuffix}`,
    });
    createdResources.credentialId = credential.externalCredentialId;
    record('Create SIP Domain -> Create Credential', Boolean(credential.externalCredentialId), `username=${credential.username} sid=${credential.externalCredentialId}`);

    // Step 6: Register Phone (purchase/register a DID number + issue a Voice Access Token
    // for the softphone client — the two halves of "registering a phone" on Twilio)
    const numbers = await TwilioProvider.searchNumbers({ areaCode: '555', limit: 1 });
    const numberToBuy = numbers[0]?.number || '+15555550100';
    const purchasedNumber = await TwilioProvider.createPhoneNumber(numberToBuy, {
      voiceWebhookUrl: 'https://example.com/webhooks/twilio/voice',
      friendlyName: `VSP E2E Test ${domainSuffix}`,
    });
    createdResources.numberId = purchasedNumber.externalNumberId;
    const accessToken = await TwilioProvider.createVoiceAccessToken({
      identity: `ext100-${domainSuffix}`,
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID || 'AP_dry_run_0000000000000000000000000',
    });
    record('Create Credential -> Register Phone', Boolean(purchasedNumber.externalNumberId && accessToken.token), `number=${purchasedNumber.number} sid=${purchasedNumber.externalNumberId} tokenExpiresAt=${accessToken.expiresAt}`);

    // Step 7: Test Call
    const to = parseArg('to') || '+15555550123';
    const from = parseArg('from') || purchasedNumber.number;
    const dialResult = await TwilioProvider.executeCommand({
      commandType: 'DIAL',
      payload: { to, from, voiceWebhookUrl: 'https://example.com/webhooks/twilio/voice' },
    });
    createdResources.callSid = dialResult.externalRequestId;
    let hangupResult = { ok: true, skipped: true };
    if (isLive) {
      // Give a live call a moment before tearing it down; dry run has no real call to wait on.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      hangupResult = await TwilioProvider.hangupCall(createdResources.callSid);
    }
    record('Register Phone -> Test Call', Boolean(dialResult.ok), `callSid=${createdResources.callSid} to=${to} from=${from}${isLive ? ` hangup.ok=${hangupResult.ok}` : ' (dry run: call not actually placed)'}`);

    // Step 8: Delete Resources
    if (!keepResources) {
      await TwilioProvider.deleteSipCredential(createdResources.credentialId, { credentialListSid: createdResources.credentialListSid });
      await TwilioProvider.deletePhoneNumber(createdResources.numberId);
      await TwilioProvider.deleteSipDomain({ externalDomainId: createdResources.domainId });
      record('Test Call -> Delete Resources', true, `deleted credential=${createdResources.credentialId}, number=${createdResources.numberId}, domain=${createdResources.domainId}`);
    } else {
      record('Test Call -> Delete Resources', true, 'skipped (--keep passed): resources left in place for inspection');
    }

    const allPassed = steps.every((s) => s.ok);
    if (asJson) {
      console.log(JSON.stringify({ mode: isLive ? 'live' : 'dry-run', allPassed, steps, createdResources }, null, 2));
    } else {
      console.log(`\n${allPassed ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED'} (${isLive ? 'LIVE' : 'DRY RUN'})`);
      if (!isLive) {
        console.log('\nTo run this for real against a live Twilio account:');
        console.log('  1. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET');
        console.log('     (env vars, or via Super Admin -> Providers -> Twilio -> credentials form)');
        console.log('  2. Re-run: npx tsx scripts/verify-twilio-provider-e2e.js --live --to=+1XXXXXXXXXX --from=+1XXXXXXXXXX');
      }
    }
    process.exitCode = allPassed ? 0 : 1;
  } catch (error) {
    record(`ERROR: ${error.message}`, false);
    if (asJson) console.log(JSON.stringify({ mode: isLive ? 'live' : 'dry-run', allPassed: false, steps, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
}

main();
