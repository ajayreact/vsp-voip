#!/usr/bin/env node
/**
 * Simulate handleCallInitiated decision tree for a DID (no code changes).
 * Usage: node scripts/diagnose-inbound-decision-tree.js [+1DID]
 */
require('dotenv').config();

const DID = process.argv[2] || '+19563961388';

async function main() {
  const { getPrisma } = require('../db.js');
  const { resolveRingTargets } = require('../lib/inboundRouting.js');
  const { applyNumberRoutingToGreeting } = require('../lib/numberRouting.js');
  const { usesRingFirstPath, usesOptionARingPath, resolveDeviceRingStrategy } = require('../lib/ringTargetPolicy.js');
  const { loadCredentialConnectionId } = require('../lib/softphone.js');
  const { resolveExtensionInboundPolicy } = require('../lib/extensionInbound.js');
  const { isWithinBusinessHours } = require('../lib/businessHours.js');
  const { normalizeIvrOptions } = require('../lib/callRouting.js');
  const { resolveGreetingMessage } = require('../lib/greeting.js');

  const prisma = await getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { number: DID },
    include: {
      extension: { include: { user: true } },
      tenant: true,
    },
  });

  if (!phone) {
    console.error(`DID ${DID} not found`);
    process.exit(1);
  }

  let greeting = await prisma.greeting.findUnique({ where: { tenantId: phone.tenantId } });
  greeting = applyNumberRoutingToGreeting(greeting, phone);
  const connectionId = await loadCredentialConnectionId(prisma);
  const { targets, ringTimeout, strategy } = await resolveRingTargets(
    prisma,
    phone.tenantId,
    greeting || {},
    phone,
    connectionId,
  );
  const ringsMobileApp = usesOptionARingPath(targets);
  const ivrOptions = normalizeIvrOptions(greeting?.ivrOptions);
  const ivrWouldRun = Boolean(greeting?.ivrEnabled && ivrOptions.length && !ringsMobileApp);
  let businessHoursClosed = false;
  if (greeting?.businessHoursEnabled) {
    businessHoursClosed = !isWithinBusinessHours(
      greeting.businessHours,
      phone.tenant?.timezone || 'America/New_York',
    );
  }
  const extPolicy = await resolveExtensionInboundPolicy(
    prisma,
    phone.tenant,
    phone,
    '+19724301252',
    { credentialConnectionId: connectionId },
  );

  const deferChecks = [];
  deferChecks.push({
    gate: 'ringsMobileApp (usesOptionARingPath)',
    pass: !ringsMobileApp,
    detail: String(ringsMobileApp),
  });
  deferChecks.push({ gate: 'ivrWouldRun', pass: !ivrWouldRun, detail: String(ivrWouldRun) });
  deferChecks.push({ gate: 'businessHoursClosed', pass: !businessHoursClosed, detail: String(businessHoursClosed) });
  deferChecks.push({
    gate: 'extPolicy.action === ring',
    pass: !extPolicy?.action || extPolicy.action === 'ring',
    detail: extPolicy?.action ?? 'ring (default)',
  });
  deferChecks.push({ gate: 'targets.length > 0', pass: targets.length > 0, detail: String(targets.length) });
  deferChecks.push({
    gate: 'usesRingFirstPath(targets)',
    pass: usesRingFirstPath(targets),
    detail: String(usesRingFirstPath(targets)),
  });
  deferChecks.push({
    gate: 'playGreetingBeforeConnect === false (or DESK_FIRST skip)',
    pass: greeting?.playGreetingBeforeConnect === false || require('../lib/ringTargetPolicy.js').skipsPreConnectAnnouncements(targets),
    detail: String(greeting?.playGreetingBeforeConnect),
  });
  deferChecks.push({
    gate: 'recording preamble disabled for defer (or DESK_FIRST skip)',
    pass: require('../lib/ringTargetPolicy.js').skipsPreConnectAnnouncements(targets) || !(
      greeting?.playCallRecordingNotice !== false
      && greeting?.callRecordingEnabled !== false
    ),
    detail: `playCallRecordingNotice=${greeting?.playCallRecordingNotice} callRecordingEnabled=${greeting?.callRecordingEnabled}`,
  });

  const firstDeferBlock = deferChecks.find((c) => !c.pass);
  const deferPstnAnswerUntilAgent = !firstDeferBlock;

  let handleCallInitiatedBranch = 'unknown';
  if (businessHoursClosed && greeting?.businessHoursEnabled) {
    handleCallInitiatedBranch = 'after_hours_closed (speakCall)';
  } else if (greeting?.ivrEnabled && ivrOptions.length && !ringsMobileApp) {
    handleCallInitiatedBranch = 'IVR gatherUsingSpeak (L1575)';
  } else if (extPolicy?.action === 'block') {
    handleCallInitiatedBranch = 'extPolicy block speakCall';
  } else if (extPolicy?.action === 'voicemail') {
    handleCallInitiatedBranch = 'extPolicy voicemail';
  } else if (extPolicy?.action === 'forward') {
    handleCallInitiatedBranch = 'extPolicy forward -> startConnectFlow';
  } else if (extPolicy?.action === 'screen') {
    handleCallInitiatedBranch = 'extPolicy screen gather';
  } else if (ringsMobileApp) {
    handleCallInitiatedBranch = 'ringsMobileApp -> startConnectFlow skipAnnouncements (L1642)';
  } else if (greeting?.playGreetingBeforeConnect !== false && !require('../lib/ringTargetPolicy.js').skipsPreConnectAnnouncements(targets)) {
    handleCallInitiatedBranch = 'playGreetingBeforeConnect -> speakCall greeting (L1669) — desk dial NOT yet';
  } else {
    handleCallInitiatedBranch = 'startConnectFlow (L1680)';
  }

  const resolvedGreetingText = resolveGreetingMessage(
    greeting?.message || 'Welcome to {company}. Please hold while we connect you.',
    phone.tenant?.name || '',
  );

  let startConnectFlowBranch = 'not reached in handleCallInitiated';
  if (
    handleCallInitiatedBranch.includes('startConnectFlow')
    || handleCallInitiatedBranch.includes('greeting')
  ) {
    const skipAnnouncements = ringsMobileApp || extPolicy?.action === 'forward';
    const deskFirstSkip = require('../lib/ringTargetPolicy.js').skipsPreConnectAnnouncements(targets);
    const preambleWouldPlay = !skipAnnouncements
      && !deskFirstSkip
      && greeting?.playCallRecordingNotice !== false
      && greeting?.callRecordingEnabled !== false
      && !deferPstnAnswerUntilAgent;

    if (handleCallInitiatedBranch.includes('greeting')) {
      startConnectFlowBranch = 'after speak ended: startConnectFlow -> '
        + (preambleWouldPlay ? 'preamble recording speak (L573) then dial' : 'startRinging -> dialDestination');
    } else if (preambleWouldPlay) {
      startConnectFlowBranch = 'startConnectFlow -> preamble recording speak (L573) then startRinging';
    } else if (!targets.length) {
      startConnectFlowBranch = 'startConnectFlow -> routeToVoicemailOrHangup (no targets)';
    } else {
      startConnectFlowBranch = 'startConnectFlow -> startRinging -> dialDestination (L581)';
    }
  }

  console.log('=== Inbound decision tree simulation ===\n');
  console.log(JSON.stringify({
    did: DID,
    tenantId: phone.tenantId,
    tenantName: phone.tenant?.name,
    phoneRoutingType: phone.routingType,
    extensionId: phone.extension?.id,
    extensionNumber: phone.extension?.extensionNumber,
    deviceRingStrategy: resolveDeviceRingStrategy(phone.extension),
    targets: targets.map((t) => ({
      type: t.type,
      endpointType: t.endpointType,
      deviceRingStrategy: t.deviceRingStrategy,
      extensionId: t.extensionId,
    })),
    ringTimeout,
    ringStrategy: strategy,
    runtimeValues: {
      deferPstnAnswerUntilAgent,
      ivrWouldRun,
      playGreetingBeforeConnect: greeting?.playGreetingBeforeConnect,
      playCallRecordingNotice: greeting?.playCallRecordingNotice,
      callRecordingEnabled: greeting?.callRecordingEnabled,
      businessHoursClosed,
      extPolicyAction: extPolicy?.action ?? null,
      ringsMobileApp,
      usesRingFirstPath: usesRingFirstPath(targets),
      usesOptionARingPath: usesOptionARingPath(targets),
      skipsPreConnectAnnouncements: require('../lib/ringTargetPolicy.js').skipsPreConnectAnnouncements(targets),
    },
    deferGateResults: deferChecks,
    firstDeferBlocker: firstDeferBlock?.gate ?? null,
    handleCallInitiatedBranch,
    startConnectFlowBranch,
    greetingMessageResolved: resolvedGreetingText,
    ringGroupEnabled: greeting?.ringGroupEnabled,
    ivrEnabled: greeting?.ivrEnabled,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
