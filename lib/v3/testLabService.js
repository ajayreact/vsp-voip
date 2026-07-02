/**
 * V3 Test Lab Service — automated integration harness for staging validation.
 *
 * Creates an isolated test tenant, seeds employees/extensions/numbers/PBX objects,
 * runs runtime sync + validation, produces a pass/fail report, and tears down.
 *
 * Safety: requires V3_TEST_LAB_ENABLED=true; blocks production hosts by default.
 */

const { randomUUID } = require('crypto');
const { hashPassword } = require('../auth');
const { loadPlatformSettings, getDefaultFees } = require('../platformSettings');
const { normalizePhoneNumber } = require('../phone');
const { unassignAllDidsForTenant } = require('../adminDidManagement');
const auditService = require('./auditService');
const employeeService = require('./employeeService');
const numberInventoryService = require('./numberInventoryService');
const assignmentService = require('./assignmentService');
const ringGroupService = require('./ringGroupService');
const queueService = require('./queueService');
const businessHoursService = require('./businessHoursService');
const voicemailService = require('./voicemailService');
const callFlowService = require('./callFlowService');
const callFlowNodeService = require('./callFlowNodeService');
const runtimeSyncService = require('./runtime/runtimeSyncService');
const runtimeValidationService = require('./runtimeValidationService');
const productionHealthService = require('./productionHealthService');
const diagnosticsService = require('./diagnosticsService');
const repairService = require('./repairService');
const { isRuntimeSyncEnabledForTenant } = require('./runtime/runtimeFeatureFlag');

const TEST_LAB_NAME_PREFIX = 'VSP V3 Test';
const TEST_LAB_SOURCE = 'v3:TEST_LAB';
const DEFAULT_EMPLOYEE_COUNT = 20;
const MAX_EMPLOYEES = 50;

function parseEnvBool(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isTestLabEnabled() {
  return parseEnvBool('V3_TEST_LAB_ENABLED');
}

function assertTestLabAllowed() {
  if (!isTestLabEnabled()) {
    throw Object.assign(new Error('Test Lab is disabled. Set V3_TEST_LAB_ENABLED=true to enable.'), { status: 403, code: 'TEST_LAB_DISABLED' });
  }
  if (process.env.NODE_ENV === 'production' && !parseEnvBool('V3_TEST_LAB_ALLOW_PRODUCTION')) {
    throw Object.assign(new Error('Test Lab is blocked in production. Set V3_TEST_LAB_ALLOW_PRODUCTION=true only on staging.'), { status: 403, code: 'TEST_LAB_PRODUCTION_BLOCKED' });
  }
  const publicUrl = String(process.env.API_PUBLIC_URL || '').toLowerCase();
  if (publicUrl.includes('vspphone.com') && !parseEnvBool('V3_TEST_LAB_ALLOW_PRODUCTION')) {
    throw Object.assign(new Error('Test Lab is blocked on production host (vspphone.com). Use staging only.'), { status: 403, code: 'TEST_LAB_HOST_BLOCKED' });
  }
}

function isTestLabTenantName(name) {
  const n = String(name || '');
  return n.startsWith(TEST_LAB_NAME_PREFIX) || n.toLowerCase().startsWith('test-lab-');
}

async function runStep(steps, name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    steps.push({
      step: name,
      status: 'pass',
      durationMs: Date.now() - started,
      details: result?.details || result || {},
    });
    return result;
  } catch (error) {
    steps.push({
      step: name,
      status: 'fail',
      durationMs: Date.now() - started,
      error: error.message,
      details: error.details || null,
    });
    throw error;
  }
}

async function runStepOptional(steps, name, fn, { skipReason } = {}) {
  const started = Date.now();
  try {
    const result = await fn();
    steps.push({
      step: name,
      status: 'pass',
      durationMs: Date.now() - started,
      details: result?.details || result || {},
    });
    return result;
  } catch (error) {
    if (error.code === 'RUNTIME_SYNC_DISABLED' || skipReason) {
      steps.push({
        step: name,
        status: 'skip',
        durationMs: Date.now() - started,
        error: error.message,
        details: { reason: skipReason || error.message },
      });
      return null;
    }
    steps.push({
      step: name,
      status: 'fail',
      durationMs: Date.now() - started,
      error: error.message,
    });
    throw error;
  }
}

async function createTestTenant(prisma, { tenantName, adminEmail, adminPassword } = {}, ctx = {}) {
  assertTestLabAllowed();

  const baseName = String(tenantName || TEST_LAB_NAME_PREFIX).trim();
  let name = baseName;
  const existing = await prisma.tenant.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    name = `${baseName} ${Date.now()}`;
  }

  const platform = await loadPlatformSettings(prisma);
  const defaults = getDefaultFees(platform);
  const suffix = randomUUID().slice(0, 8);
  const email = adminEmail || `v3-testlab-admin-${suffix}@test.local`;
  const password = adminPassword || `TestLab${suffix}!`;

  const emailTaken = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (emailTaken) {
    throw Object.assign(new Error('Test lab admin email collision — retry'), { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name,
      platformFeeSetup: defaults.setup,
      platformFeeMonthly: defaults.monthly,
      greeting: {
        create: { message: 'Welcome to VSP V3 Test Lab. Your call is connected.' },
      },
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: 'V3 Test Lab Admin',
      passwordHash: await hashPassword(password),
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
    },
  });

  await auditService.log(prisma, ctx.req, {
    action: 'v3.testlab.tenant_created',
    entityType: 'Tenant',
    entityId: tenant.id,
    newValue: { name: tenant.name, adminEmail: adminUser.email },
    extra: { actor: ctx.actor?.sub },
  });

  return {
    tenant,
    adminUser: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
    credentials: { email: adminUser.email, password },
  };
}

function simulatedNumber(index, runId) {
  const suffix = String(1000 + index).padStart(4, '0');
  return normalizePhoneNumber(`+1555550${suffix}`) || `+1555550${suffix}`;
}

async function reserveSimulatedNumber(prisma, number, ctx) {
  return numberInventoryService.reserveNumber(prisma, {
    number,
    country: 'US',
    region: 'Test',
    locality: 'Test Lab',
    capabilities: { voice: true, sms: false },
    monthlyCost: 0,
    reservedByUserId: ctx.actor?.sub || null,
    notes: 'V3 Test Lab simulated number',
  });
}

async function assignSimulatedNumberToTenant(prisma, phoneNumberId, tenantId, ctx) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });
  if (phone.source !== numberInventoryService.V3_SOURCE.RESERVED && phone.source !== TEST_LAB_SOURCE) {
    const label = phone.label || '';
    const isTestLab = label.includes('Test Lab') || phone.number.startsWith('+1555');
    if (!isTestLab) {
      throw Object.assign(new Error('Refusing to assign non-test-lab number in simulate mode'), { status: 403 });
    }
  }

  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      tenantId,
      source: TEST_LAB_SOURCE,
      isActive: true,
    },
  });

  await auditService.log(prisma, ctx.req, {
    action: 'v3.testlab.number_assigned',
    entityType: 'PhoneNumber',
    entityId: phoneNumberId,
    newValue: { tenantId, number: updated.number, simulated: true },
  });

  return updated;
}

function buildTestCallFlowDefinition({ ringGroupId, ringGroupName, voicemailExtensionId, mailbox }) {
  const start = callFlowNodeService.createNode('START', { x: 80, y: 120 });
  const hours = callFlowNodeService.createNode('BUSINESS_HOURS', { x: 280, y: 120 }, {
    schedule: { mon: ['09:00', '17:00'], tue: ['09:00', '17:00'], wed: ['09:00', '17:00'], thu: ['09:00', '17:00'], fri: ['09:00', '17:00'] },
    timezone: 'America/New_York',
  });
  const ringGroup = callFlowNodeService.createNode('RING_GROUP', { x: 520, y: 60 }, {
    ringGroupId,
    ringGroupName,
  });
  const voicemail = callFlowNodeService.createNode('VOICEMAIL', { x: 520, y: 200 }, {
    extensionId: voicemailExtensionId,
    mailbox,
  });
  const end = callFlowNodeService.createNode('END', { x: 760, y: 120 });

  let definition = callFlowNodeService.normalizeDefinition({
    version: 1,
    nodes: [start, hours, ringGroup, voicemail, end],
    edges: [],
  });
  definition = callFlowNodeService.connectNodes(definition, start.id, hours.id);
  definition = callFlowNodeService.connectNodes(definition, hours.id, ringGroup.id, { sourceHandle: 'open', label: 'open' });
  definition = callFlowNodeService.connectNodes(definition, hours.id, voicemail.id, { sourceHandle: 'closed', label: 'closed' });
  definition = callFlowNodeService.connectNodes(definition, ringGroup.id, end.id);
  definition = callFlowNodeService.connectNodes(definition, voicemail.id, end.id);
  return definition;
}

async function seedTestTenant(prisma, tenantId, options = {}, ctx = {}) {
  const employeeCount = Math.min(Math.max(Number(options.employeeCount) || DEFAULT_EMPLOYEE_COUNT, 1), MAX_EMPLOYEES);
  const simulateNumbers = options.simulateNumbers !== false;
  const runId = options.runId || randomUUID();
  const steps = [];
  const artifacts = {
    employees: [],
    extensions: [],
    numbers: [],
    ringGroups: [],
    queues: [],
    callFlows: [],
  };

  const actor = { role: 'SUPER_ADMIN', sub: ctx.actor?.sub || ctx.req?.user?.sub || 'test-lab' };

  await runStep(steps, 'create_employees', async () => {
    for (let i = 0; i < employeeCount; i += 1) {
      const suffix = `${runId.slice(0, 6)}-${i + 1}`;
      const created = await employeeService.createEmployee(prisma, tenantId, {
        name: `Test Employee ${i + 1}`,
        email: `v3-testlab-${suffix}@test.local`,
        password: `TestLab${i + 1}!`,
      }, { req: ctx.req, actor });
      artifacts.employees.push(created.employee);
      artifacts.extensions.push(created.extension);
    }
    return { details: { count: employeeCount } };
  });

  const extIds = artifacts.extensions.map((e) => e.id);

  if (simulateNumbers) {
    await runStep(steps, 'reserve_numbers', async () => {
      const count = Math.min(employeeCount, 20);
      for (let i = 0; i < count; i += 1) {
        const num = simulatedNumber(i + 1, runId);
        const reserved = await reserveSimulatedNumber(prisma, num, ctx);
        artifacts.numbers.push(reserved);
      }
      return { details: { count: artifacts.numbers.length } };
    });

    await runStep(steps, 'assign_numbers_tenant', async () => {
      for (const row of artifacts.numbers) {
        await assignSimulatedNumberToTenant(prisma, row.id, tenantId, ctx);
      }
      return { details: { count: artifacts.numbers.length } };
    });

    await runStep(steps, 'assign_numbers_extensions', async () => {
      let assigned = 0;
      for (let i = 0; i < Math.min(artifacts.numbers.length, extIds.length); i += 1) {
        await assignmentService.assignNumberToExtension(prisma, tenantId, {
          phoneNumberId: artifacts.numbers[i].id,
          extensionId: extIds[i],
          employeeId: artifacts.employees[i]?.id,
        }, { req: ctx.req, actor });
        assigned += 1;
      }
      return { details: { assigned } };
    });
  } else {
    steps.push({ step: 'reserve_numbers', status: 'skip', durationMs: 0, details: { reason: 'simulateNumbers=false' } });
    steps.push({ step: 'assign_numbers_tenant', status: 'skip', durationMs: 0, details: { reason: 'simulateNumbers=false' } });
    steps.push({ step: 'assign_numbers_extensions', status: 'skip', durationMs: 0, details: { reason: 'simulateNumbers=false' } });
  }

  await runStep(steps, 'create_ring_groups', async () => {
    const group1 = await ringGroupService.createRingGroup(prisma, tenantId, {
      name: 'Test Lab Sales',
      memberExtensionIds: extIds.slice(0, Math.min(5, extIds.length)),
      strategy: 'SIMULTANEOUS',
    }, { req: ctx.req, actor });
    const group2 = await ringGroupService.createRingGroup(prisma, tenantId, {
      name: 'Test Lab Support',
      memberExtensionIds: extIds.slice(5, Math.min(10, extIds.length)),
      strategy: 'ROUND_ROBIN',
    }, { req: ctx.req, actor });
    artifacts.ringGroups.push(group1, group2);
    return { details: { count: 2 } };
  });

  await runStep(steps, 'create_queues', async () => {
    const queue1 = await queueService.createQueue(prisma, tenantId, {
      name: 'Test Lab Queue A',
      agentExtensionIds: extIds.slice(0, Math.min(4, extIds.length)),
    }, { req: ctx.req, actor });
    const queue2 = await queueService.createQueue(prisma, tenantId, {
      name: 'Test Lab Queue B',
      agentExtensionIds: extIds.slice(4, Math.min(8, extIds.length)),
    }, { req: ctx.req, actor });
    artifacts.queues.push(queue1, queue2);
    return { details: { count: 2 } };
  });

  await runStep(steps, 'create_business_hours', async () => {
    const schedule = await businessHoursService.createSchedule(prisma, tenantId, {
      name: 'Test Lab Default Hours',
      timezone: 'America/New_York',
      isDefault: true,
      weekdays: {
        mon: [{ start: '09:00', end: '17:00' }],
        tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }],
        thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }],
      },
    }, { req: ctx.req, actor });
    return { details: { id: schedule.id } };
  });

  await runStep(steps, 'create_voicemail', async () => {
    const vm = await voicemailService.createVoicemailBox(prisma, tenantId, {
      mailboxNumber: '8999',
      extensionId: extIds[0],
      greeting: { text: 'Test lab voicemail' },
      isActive: true,
    }, { req: ctx.req, actor });
    artifacts.voicemail = vm;
    return { details: { id: vm.id } };
  });

  await runStep(steps, 'create_call_flow', async () => {
    const mainDid = artifacts.numbers[0]?.number || null;
    const definition = buildTestCallFlowDefinition({
      ringGroupId: artifacts.ringGroups[0]?.id,
      ringGroupName: artifacts.ringGroups[0]?.name,
      voicemailExtensionId: extIds[0],
      mailbox: '8999',
    });
    const flow = await callFlowService.createCallFlow(prisma, tenantId, {
      name: 'Test Lab Main Flow',
      did: mainDid,
      definition,
    }, { req: ctx.req, actor });
    artifacts.callFlows.push(flow);
    return { details: { id: flow.id, did: mainDid } };
  });

  await runStep(steps, 'publish_call_flow', async () => {
    const flowId = artifacts.callFlows[0]?.id;
    const published = await callFlowService.updateCallFlow(prisma, tenantId, flowId, {
      status: 'PUBLISHED',
    }, { req: ctx.req, actor });
    artifacts.callFlows[0] = published;
    return { details: { id: published.id, status: published.status } };
  });

  return { steps, artifacts, employeeCount, simulateNumbers };
}

async function validateAndRepair(prisma, tenantId, steps, ctx) {
  const runtimeEnabled = isRuntimeSyncEnabledForTenant(tenantId);

  await runStepOptional(steps, 'runtime_resync', async () => {
    if (!runtimeEnabled) {
      throw Object.assign(new Error('Runtime sync disabled for tenant'), { status: 403, code: 'RUNTIME_SYNC_DISABLED' });
    }
    const result = await runtimeSyncService.resyncAll(prisma, tenantId, { req: ctx.req });
    let processed = 0;
    for (let i = 0; i < 20; i += 1) {
      const batch = await runtimeSyncService.processPending(prisma, tenantId, { limit: 50, req: ctx.req });
      processed += batch.processed || 0;
      if (!batch.processed) break;
    }
    return { details: { enqueued: result?.enqueued?.length || 0, processed } };
  }, { skipReason: runtimeEnabled ? null : 'Runtime sync disabled — enable V3_RUNTIME_SYNC_ENABLED and allowlist this tenant' });

  await runStep(steps, 'runtime_validation', async () => {
    const validation = await runtimeValidationService.runValidation(prisma, tenantId, { req: ctx.req });
    return { details: { overall: validation.overall, domains: validation.domains?.length || 0 } };
  });

  await runStepOptional(steps, 'runtime_repair', async () => {
    if (!runtimeEnabled) {
      throw Object.assign(new Error('Runtime sync disabled'), { status: 403, code: 'RUNTIME_SYNC_DISABLED' });
    }
    const result = await runtimeSyncService.repairRuntime(prisma, tenantId, { req: ctx.req });
    return { details: { count: result?.count || 0 } };
  }, { skipReason: runtimeEnabled ? null : 'Runtime sync disabled' });

  await runStep(steps, 'pbx_repair', async () => {
    const inspect = await repairService.inspect(prisma, tenantId);
    const repair = inspect.changes?.length
      ? await repairService.repair(prisma, tenantId, { apply: true })
      : { applied: [] };
    return { details: { inspected: inspect.changes?.length || 0, applied: repair.applied?.length || 0 } };
  });

  await runStep(steps, 'production_health', async () => {
    const health = await productionHealthService.getProductionHealth(prisma, tenantId);
    return { details: { overall: health.overall, critical: health.criticalIssues?.length || 0 } };
  });

  await runStep(steps, 'diagnostics', async () => {
    const diagnostics = await diagnosticsService.getDiagnostics(prisma, tenantId);
    return { details: { issues: diagnostics.issues?.length || 0 } };
  });

  await runStep(steps, 'compare_runtime_v3', async () => {
    const validation = await runtimeValidationService.getValidationReport(prisma, tenantId);
    const failedDomains = (validation.domains || []).filter((d) => d.level === 'red');
    const warnDomains = (validation.domains || []).filter((d) => d.level === 'yellow');
    const pass = failedDomains.length === 0 && (runtimeEnabled ? validation.overall !== 'red' : true);
    if (!pass) {
      throw Object.assign(new Error(`Runtime drift detected in ${failedDomains.map((d) => d.domain).join(', ')}`), {
        status: 422,
        details: { failedDomains, warnDomains, overall: validation.overall },
      });
    }
    return {
      details: {
        overall: validation.overall,
        runtimeEnabled,
        warnings: warnDomains.length,
        pass: true,
      },
    };
  });
}

async function teardownTestTenant(prisma, tenantId, ctx = {}) {
  assertTestLabAllowed();

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });

  const runRecord = await prisma.v3TestLabRun.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  if (!isTestLabTenantName(tenant.name) && !runRecord) {
    throw Object.assign(new Error('Refusing teardown: tenant is not a test lab tenant'), { status: 403, code: 'NOT_TEST_LAB_TENANT' });
  }

  await unassignAllDidsForTenant(prisma, tenantId, { notes: 'V3 Test Lab teardown' });

  const testNumbers = await prisma.phoneNumber.findMany({
    where: {
      OR: [
        { source: TEST_LAB_SOURCE },
        { number: { startsWith: '+1555' }, tenantId: null },
      ],
    },
    select: { id: true },
  });
  if (testNumbers.length) {
    await prisma.phoneNumber.deleteMany({ where: { id: { in: testNumbers.map((n) => n.id) } } });
  }

  await prisma.v3RuntimeSyncJob.deleteMany({ where: { tenantId } });
  await prisma.v3RuntimeLink.deleteMany({ where: { tenantId } });
  await prisma.v3MigrationRun.deleteMany({ where: { tenantId } });
  await prisma.v3TestLabRun.updateMany({
    where: { tenantId },
    data: { status: 'CLEANED_UP', finishedAt: new Date() },
  });

  const v3Tables = [
    'v3CallFlow', 'v3RingGroup', 'v3Queue', 'v3BusinessHoursSchedule', 'v3Holiday',
    'v3VoicemailBox', 'v3DeskDevice', 'v3SoftphoneProfile', 'v3UserPreference',
    'v3DevicePreference', 'v3PresenceConfig', 'v3TenantBackup',
  ];
  for (const table of v3Tables) {
    if (prisma[table]?.deleteMany) {
      await prisma[table].deleteMany({ where: { tenantId } });
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { resetTenantPbxData } = require('../tenantPbxReset');
      await resetTenantPbxData(prisma, tenantId, { skipTelnyx: true, clearCallHistory: true });
    } catch (err) {
      console.warn('[V3 Test Lab] PBX reset skipped:', err.message);
    }
  }

  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.greeting.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });

  await auditService.log(prisma, ctx.req, {
    action: 'v3.testlab.teardown',
    entityType: 'Tenant',
    entityId: tenantId,
    newValue: { name: tenant.name },
  });

  return { tenantId, tenantName: tenant.name, removed: true };
}

async function runIntegrationSuite(prisma, options = {}, ctx = {}) {
  assertTestLabAllowed();

  const employeeCount = Math.min(Math.max(Number(options.employeeCount) || DEFAULT_EMPLOYEE_COUNT, 1), MAX_EMPLOYEES);
  const simulateNumbers = options.simulateNumbers !== false;
  const teardownOnFinish = options.teardown !== false && options.teardownOnFinish !== false;
  const tenantName = options.tenantName || TEST_LAB_NAME_PREFIX;
  const runId = randomUUID();
  const startedAt = new Date();
  const allSteps = [];

  let run = await prisma.v3TestLabRun.create({
    data: {
      id: runId,
      status: 'RUNNING',
      tenantName,
      employeeCount,
      simulateNumbers,
      teardownOnFinish,
      steps: [],
      startedAt,
      createdByUserId: ctx.actor?.sub || ctx.req?.user?.sub || null,
    },
  });

  let tenantId = null;
  let credentials = null;
  let artifacts = null;
  let failed = false;
  let errorMessage = null;

  try {
    const tenantResult = await runStep(allSteps, 'create_tenant', async () => {
      const created = await createTestTenant(prisma, { tenantName }, ctx);
      tenantId = created.tenant.id;
      credentials = created.credentials;
      return {
        details: {
          tenantId: created.tenant.id,
          tenantName: created.tenant.name,
          adminEmail: created.adminUser.email,
        },
      };
    });

    run = await prisma.v3TestLabRun.update({
      where: { id: runId },
      data: { tenantId, tenantName: tenantResult?.details?.tenantName || tenantName },
    });

    const seed = await seedTestTenant(prisma, tenantId, { employeeCount, simulateNumbers, runId }, ctx);
    allSteps.push(...seed.steps);
    artifacts = seed.artifacts;

    await validateAndRepair(prisma, tenantId, allSteps, ctx);

    if (teardownOnFinish) {
      await runStep(allSteps, 'teardown', async () => {
        const result = await teardownTestTenant(prisma, tenantId, ctx);
        tenantId = null;
        return { details: result };
      });
    }
  } catch (error) {
    failed = true;
    errorMessage = error.message;
    if (tenantId && teardownOnFinish) {
      try {
        await teardownTestTenant(prisma, tenantId, ctx);
        allSteps.push({ step: 'teardown_after_failure', status: 'pass', durationMs: 0, details: { cleaned: true } });
      } catch (teardownErr) {
        allSteps.push({ step: 'teardown_after_failure', status: 'fail', durationMs: 0, error: teardownErr.message });
      }
    }
  }

  const passed = allSteps.filter((s) => s.status === 'pass').length;
  const failedSteps = allSteps.filter((s) => s.status === 'fail');
  const skipped = allSteps.filter((s) => s.status === 'skip').length;
  const overallPass = !failed && failedSteps.length === 0;

  const summary = {
    totalSteps: allSteps.length,
    passed,
    failed: failedSteps.length,
    skipped,
    overallPass,
    runtimeSyncEnabled: tenantId ? isRuntimeSyncEnabledForTenant(tenantId) : isRuntimeSyncEnabledForTenant(run.tenantId),
    error: errorMessage,
  };

  const report = {
    runId,
    tenantId: run.tenantId,
    tenantName: run.tenantName,
    credentials: teardownOnFinish ? null : credentials,
    artifacts: teardownOnFinish ? { note: 'Teardown completed — artifacts removed' } : {
      employees: artifacts?.employees?.length || 0,
      extensions: artifacts?.extensions?.length || 0,
      numbers: artifacts?.numbers?.length || 0,
      ringGroups: artifacts?.ringGroups?.length || 0,
      queues: artifacts?.queues?.length || 0,
      callFlows: artifacts?.callFlows?.length || 0,
    },
    steps: allSteps,
    summary,
    checklist: buildChecklistHints(allSteps, summary),
    finishedAt: new Date().toISOString(),
  };

  const status = overallPass ? 'SUCCESS' : (passed > 0 ? 'PARTIAL' : 'FAILED');
  if (teardownOnFinish && overallPass) {
    run = await prisma.v3TestLabRun.update({
      where: { id: runId },
      data: {
        status: 'CLEANED_UP',
        steps: allSteps,
        summary,
        report,
        overallPass,
        finishedAt: new Date(),
        tenantId: null,
      },
    });
  } else {
    run = await prisma.v3TestLabRun.update({
      where: { id: runId },
      data: {
        status: failed ? 'FAILED' : status,
        tenantId: run.tenantId,
        steps: allSteps,
        summary,
        report,
        overallPass,
        finishedAt: new Date(),
      },
    });
  }

  await auditService.log(prisma, ctx.req, {
    action: 'v3.testlab.completed',
    entityType: 'V3TestLabRun',
    entityId: runId,
    newValue: summary,
  });

  return { run, report, summary, credentials: teardownOnFinish ? null : credentials };
}

function buildChecklistHints(steps, summary) {
  const stepMap = Object.fromEntries(steps.map((s) => [s.step, s.status]));
  return [
    { area: 'Employee lifecycle', automated: ['create_employees', 'pbx_repair'], manual: ['Login', 'Delete', 'Restore', 'QR/SIP verify in UI'] },
    { area: 'Number lifecycle', automated: ['reserve_numbers', 'assign_numbers_tenant', 'assign_numbers_extensions'], manual: ['Purchase live', 'Remove/Reassign in UI'] },
    { area: 'Desk phone lifecycle', automated: [], manual: ['Add Yealink', 'Provision', 'Register', 'Reboot in /v3/devices'] },
    { area: 'Runtime sync', automated: ['runtime_resync', 'runtime_validation', 'compare_runtime_v3'], status: stepMap.runtime_resync || 'pending' },
    { area: 'Call Flow', automated: ['create_call_flow', 'publish_call_flow'], status: stepMap.publish_call_flow || 'pending' },
    { area: 'Repair Center', automated: ['pbx_repair', 'runtime_repair'], status: stepMap.pbx_repair || 'pending' },
    { area: 'Backup/Migration', automated: [], manual: ['Use /v3/backups and /v3/migration after keeping tenant (teardown=false)'] },
    { area: 'Monitoring', automated: ['production_health', 'diagnostics'], status: stepMap.production_health || 'pending' },
    { area: 'Telephony live calls', automated: [], manual: ['Enable V3_RUNTIME_SYNC for test tenant only; verify desk/mobile/inbound/outbound'] },
    { area: 'Harness result', automated: ['teardown'], status: summary.overallPass ? 'pass' : 'fail' },
  ];
}

async function getTestLabStatus() {
  return {
    enabled: isTestLabEnabled(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      runtimeSyncEnabled: parseEnvBool('V3_RUNTIME_SYNC_ENABLED'),
      allowProduction: parseEnvBool('V3_TEST_LAB_ALLOW_PRODUCTION'),
    },
    defaults: {
      tenantNamePrefix: TEST_LAB_NAME_PREFIX,
      employeeCount: DEFAULT_EMPLOYEE_COUNT,
      maxEmployees: MAX_EMPLOYEES,
    },
  };
}

async function getRunReport(prisma, runId) {
  const run = await prisma.v3TestLabRun.findUnique({ where: { id: runId } });
  if (!run) throw Object.assign(new Error('Test lab run not found'), { status: 404 });
  return { run, report: run.report, summary: run.summary };
}

async function listRuns(prisma, { limit = 20 } = {}) {
  const [items, total] = await Promise.all([
    prisma.v3TestLabRun.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.v3TestLabRun.count(),
  ]);
  return { items, total };
}

module.exports = {
  isTestLabEnabled,
  assertTestLabAllowed,
  isTestLabTenantName,
  getTestLabStatus,
  createTestTenant,
  seedTestTenant,
  validateAndRepair,
  teardownTestTenant,
  runIntegrationSuite,
  getRunReport,
  listRuns,
  TEST_LAB_NAME_PREFIX,
};
