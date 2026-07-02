/**
 * V3 PBX Health — green/yellow/red validation for PBX configuration objects.
 */

const ringGroupService = require('./ringGroupService');
const queueService = require('./queueService');
const businessHoursService = require('./businessHoursService');
const holidayService = require('./holidayService');
const voicemailService = require('./voicemailService');

const ORDER = { green: 0, yellow: 1, red: 2 };

function worst(...levels) {
  return levels.reduce((acc, l) => (ORDER[l] > ORDER[acc] ? l : acc), 'green');
}

function buildRingGroupHealth(item, validation) {
  const checks = {
    name: item.name ? 'green' : 'red',
    members: (item.memberExtensionIds?.length || 0) > 0 ? 'green' : 'red',
    strategy: 'green',
    overflow: item.overflowDestination ? 'green' : 'yellow',
    active: item.isActive ? 'green' : 'yellow',
    validation: validation.valid ? 'green' : 'red',
  };
  return {
    id: item.id,
    type: 'ring_group',
    name: item.name,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: validation.errors.map((e) => e.message),
  };
}

function buildQueueHealth(item, validation) {
  const checks = {
    name: item.name ? 'green' : 'red',
    agents: (item.agentExtensionIds?.length || 0) > 0 ? 'green' : 'red',
    queueNumber: item.queueNumber ? 'green' : 'yellow',
    overflow: item.overflowDestination ? 'green' : 'yellow',
    active: item.isActive ? 'green' : 'yellow',
    validation: validation.valid ? 'green' : 'red',
  };
  return {
    id: item.id,
    type: 'queue',
    name: item.name,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: validation.errors.map((e) => e.message),
  };
}

function buildScheduleHealth(item, validation) {
  const checks = {
    name: item.name ? 'green' : 'red',
    timezone: item.timezone ? 'green' : 'red',
    schedule: (Object.keys(item.weekdays || {}).length || Object.keys(item.weekends || {}).length) ? 'green' : 'red',
    default: item.isDefault ? 'green' : 'yellow',
    validation: validation.valid ? 'green' : 'red',
  };
  return {
    id: item.id,
    type: 'business_hours',
    name: item.name,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: validation.errors.map((e) => e.message),
  };
}

function buildHolidayHealth(item, validation) {
  const checks = {
    name: item.name ? 'green' : 'red',
    date: item.date ? 'green' : 'red',
    override: item.overrideDestination ? 'green' : 'yellow',
    validation: validation.valid ? 'green' : 'red',
  };
  return {
    id: item.id,
    type: 'holiday',
    name: item.name,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: validation.errors.map((e) => e.message),
  };
}

function buildVoicemailHealth(item, validation) {
  const checks = {
    mailbox: item.mailboxNumber ? 'green' : 'red',
    greeting: item.greeting?.text || item.greeting?.audioUrl ? 'green' : 'yellow',
    email: item.emailDelivery?.enabled ? 'green' : 'yellow',
    active: item.isActive ? 'green' : 'yellow',
    validation: validation.valid ? 'green' : 'red',
  };
  return {
    id: item.id,
    type: 'voicemail',
    name: item.mailboxNumber,
    overall: worst(...Object.values(checks)),
    checks,
    reasons: validation.errors.map((e) => e.message),
  };
}

async function pbxObjectsHealth(prisma, tenantId) {
  const [ringGroups, queues, schedules, holidays, voicemails] = await Promise.all([
    ringGroupService.listRingGroups(prisma, tenantId),
    queueService.listQueues(prisma, tenantId),
    businessHoursService.listSchedules(prisma, tenantId),
    holidayService.listHolidays(prisma, tenantId),
    voicemailService.listVoicemailBoxes(prisma, tenantId),
  ]);

  const ringGroupHealth = await Promise.all(
    ringGroups.items.map(async (item) => buildRingGroupHealth(item, await ringGroupService.validateRingGroup(prisma, tenantId, item))),
  );
  const queueHealth = await Promise.all(
    queues.items.map(async (item) => buildQueueHealth(item, await queueService.validateQueue(prisma, tenantId, item))),
  );
  const scheduleHealth = await Promise.all(
    schedules.items.map(async (item) => buildScheduleHealth(item, await businessHoursService.validateBusinessHours(prisma, tenantId, item))),
  );
  const holidayHealth = await Promise.all(
    holidays.items.map(async (item) => buildHolidayHealth(item, await holidayService.validateHoliday(prisma, tenantId, item))),
  );
  const voicemailHealth = await Promise.all(
    voicemails.items.map(async (item) => buildVoicemailHealth(item, await voicemailService.validateVoicemailBox(prisma, tenantId, item))),
  );

  const all = [...ringGroupHealth, ...queueHealth, ...scheduleHealth, ...holidayHealth, ...voicemailHealth];

  return {
    ringGroups: ringGroupHealth,
    queues: queueHealth,
    businessHours: scheduleHealth,
    holidays: holidayHealth,
    voicemails: voicemailHealth,
    summary: {
      total: all.length,
      ready: all.filter((h) => h.overall === 'green').length,
      warnings: all.filter((h) => h.overall === 'yellow').length,
      errors: all.filter((h) => h.overall === 'red').length,
    },
  };
}

module.exports = {
  pbxObjectsHealth,
  buildRingGroupHealth,
  buildQueueHealth,
  buildScheduleHealth,
  buildHolidayHealth,
  buildVoicemailHealth,
};
