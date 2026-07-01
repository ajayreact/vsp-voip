import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = require('../../lib/telephony-v3/internal/prisma');
const tenantBootstrap = require('../../lib/telephony-v3/Utils/tenantBootstrap');
const replayService = require('../../lib/telephony-v3/Replay/replayService');
const sessionCleanup = require('../../lib/telephony-v3/Sidecar/sessionCleanup');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
const timerService = require('../../lib/telephony-v3/Timer/timerService');
const sidecarCoordinator = require('../../lib/telephony-v3/Sidecar/sidecarCoordinator');

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260627120000_v3_phase395_hardening/migration.sql',
);

/** Runtime command types emitted by V3 command builders and FSM. */
const RUNTIME_COMMAND_TYPES = [
  'DIAL', 'ANSWER', 'BRIDGE', 'HANGUP', 'SPEAK', 'PLAY',
  'RECORD_START', 'RECORD_STOP', 'HOLD', 'UNHOLD', 'TRANSFER',
  'GATHER', 'ENQUEUE', 'DEQUEUE', 'CREATE_CONFERENCE', 'ADD_PARTICIPANT',
  'REMOVE_PARTICIPANT', 'MUTE_PARTICIPANT', 'UNMUTE_PARTICIPANT',
  'DESTROY_CONFERENCE', 'PLAY_GREETING', 'START_VOICEMAIL', 'STOP_VOICEMAIL',
  'START_RECORDING', 'STOP_RECORDING', 'REJECT', 'FORWARD',
];

const RUNTIME_FEATURE_FLAGS = [
  'holdEnabled', 'transferEnabled', 'recordingEnabled', 'voicemailEnabled',
  'conferenceEnabled', 'queueEnabled', 'ivrEnabled',
];

function parsePrismaEnum(name: string): string[] {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const match = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`, 's'));
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
}

function parseFeatureFlagColumns(): string[] {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const match = schema.match(/model V3FeatureFlag \{([^}]+)\}/s);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((col) => col.endsWith('Enabled'));
}

describe('Phase 3.9.5 hardening', () => {
  beforeEach(() => {
    metrics.resetMetricsForTests();
  });

  describe('P0-1 Prisma enum alignment', () => {
    it('includes every runtime command type in V3CommandType', () => {
      const schemaValues = parsePrismaEnum('V3CommandType');
      for (const cmd of RUNTIME_COMMAND_TYPES) {
        expect(schemaValues, `missing schema enum value: ${cmd}`).toContain(cmd);
      }
    });

    it('migration adds all sidecar command enum values', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      for (const cmd of RUNTIME_COMMAND_TYPES) {
        if (['DIAL', 'ANSWER', 'BRIDGE', 'HANGUP', 'SPEAK', 'PLAY', 'RECORD_START', 'RECORD_STOP'].includes(cmd)) {
          continue;
        }
        expect(sql, `migration missing ${cmd}`).toContain(`'${cmd}'`);
      }
    });
  });

  describe('P0-2 feature flag alignment', () => {
    it('schema contains every runtime tenant flag', () => {
      const columns = parseFeatureFlagColumns();
      for (const flag of RUNTIME_FEATURE_FLAGS) {
        expect(columns, `missing schema column: ${flag}`).toContain(flag);
      }
    });

    it('migration adds new feature flag columns', () => {
      const sql = readFileSync(MIGRATION_PATH, 'utf8');
      for (const flag of ['holdEnabled', 'conferenceEnabled', 'queueEnabled', 'ivrEnabled']) {
        expect(sql).toContain(`"${flag}"`);
      }
    });
  });

  describe('P0-3 PSTN tenant bootstrap', () => {
    beforeEach(() => {
      prisma.__setGetPrismaForTests(async () => ({
        phoneNumber: {
          findFirst: vi.fn(async ({ where }) => {
            if (where.number === '+15551234567') {
              return { tenantId: 'tenant-a', id: 'pn-1', number: where.number };
            }
            return null;
          }),
        },
      }));
    });

    it('resolves tenant from inbound DID', async () => {
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'incoming',
        state: 'ringing',
        to: '+15551234567',
        callControlId: 'cc-1',
        eventType: 'call.initiated',
      });
      expect(result.tenantId).toBe('tenant-a');
      expect(result.source).toBe('did_lookup');
      expect(result.rejected).toBeUndefined();
    });

    it('rejects unknown inbound DID safely', async () => {
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'incoming',
        state: 'ringing',
        to: '+19999999999',
        callControlId: 'cc-2',
        eventType: 'call.initiated',
      });
      expect(result.rejected).toBe(true);
      expect(result.reason).toBe('unknown_did');
    });
  });

  describe('P0-3b desk parked outbound tenant bootstrap', () => {
    beforeEach(() => {
      const platformSettings = require('../../lib/platformSettings');
      platformSettings.invalidatePlatformSettingsCache();
      prisma.__setGetPrismaForTests(async () => ({
        platformSettings: {
          findUnique: vi.fn(async () => ({ id: 'default' })),
        },
        user: {
          findFirst: vi.fn(async () => ({
            id: 'user-desk',
            tenantId: 'tenant-desk',
            telnyxSipUsername: 'deskuser',
            extensions: [{ id: 'ext-1', extensionNumber: '101', status: 'ACTIVE' }],
          })),
        },
        extension: { findFirst: vi.fn(async () => null) },
      }));
    });

    it('resolves tenant from desk parked outbound SIP from', async () => {
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'outgoing',
        state: 'parked',
        from: 'sip:deskuser@sip.telnyx.com',
        callControlId: 'cc-desk-1',
        eventType: 'call.initiated',
      });
      expect(result.tenantId).toBe('tenant-desk');
      expect(result.source).toBe('desk_outbound_payload');
      expect(result.callKind).toBe('DESK_OUTBOUND');
      expect(result.callerExtensionId).toBe('ext-1');
      expect(result.rejected).toBeUndefined();
    });

    it('resolves tenant on call.initiated with Telnyx v3: call_control_id without state=parked', async () => {
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'outgoing',
        state: null,
        from: '+13136505770',
        callControlId: 'v3:90gwIqA4pvhAOMAaLooEYLt',
        eventType: 'call.initiated',
        raw: {
          body: {
            data: {
              payload: {
                from: '+13136505770',
                direction: 'outgoing',
                sip_username: 'deskuser',
              },
            },
          },
        },
      });
      expect(result.tenantId).toBe('tenant-desk');
      expect(result.callKind).toBe('DESK_OUTBOUND');
    });

    it('resolves tenant from sip_username when from is outbound caller-id E164', async () => {
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'outgoing',
        state: 'parked',
        from: '+19724301252',
        callControlId: 'cc-desk-4',
        eventType: 'call.initiated',
        raw: {
          body: {
            data: {
              payload: {
                from: '+19724301252',
                direction: 'outgoing',
                state: 'parked',
                sip_username: 'deskuser',
              },
            },
          },
        },
      });
      expect(result.tenantId).toBe('tenant-desk');
      expect(result.callKind).toBe('DESK_OUTBOUND');
      expect(result.extensionNumber).toBe('101');
    });

    it('does not resolve desk outbound tenant from inbound DID on to', async () => {
      prisma.__setGetPrismaForTests(async () => ({
        platformSettings: {
          findUnique: vi.fn(async () => ({ id: 'default' })),
        },
        user: { findFirst: vi.fn(async () => null) },
        extension: { findFirst: vi.fn(async () => null) },
        phoneNumber: {
          findFirst: vi.fn(async () => ({ tenantId: 'wrong-tenant', id: 'pn-1', number: '+15551234567' })),
          findUnique: vi.fn(async () => null),
        },
      }));
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'outgoing',
        state: 'parked',
        from: 'sip:unknown@sip.telnyx.com',
        to: '+15551234567',
        callControlId: 'cc-desk-3',
        eventType: 'call.initiated',
      });
      expect(result.rejected).toBe(true);
      expect(result.reason).toBe('desk_caller_unresolved');
    });

    it('rejects desk parked outbound when caller cannot be resolved', async () => {
      prisma.__setGetPrismaForTests(async () => ({
        platformSettings: {
          findUnique: vi.fn(async () => ({ id: 'default' })),
        },
        user: { findFirst: vi.fn(async () => null) },
        extension: { findFirst: vi.fn(async () => null) },
        phoneNumber: { findUnique: vi.fn(async () => null) },
      }));
      const result = await tenantBootstrap.resolveTenantForWebhook({
        direction: 'outgoing',
        state: 'parked',
        from: 'sip:unknown@sip.telnyx.com',
        callControlId: 'cc-desk-2',
        eventType: 'call.initiated',
      });
      expect(result.rejected).toBe(true);
      expect(result.reason).toBe('desk_caller_unresolved');
    });
  });

  describe('P0-5 durable webhook dedup helpers', () => {
    it('detects durable duplicates from processedTelnyxEvent', async () => {
      prisma.__setGetPrismaForTests(async () => ({
        processedTelnyxEvent: {
          findUnique: vi.fn(async ({ where }) => (where.id === 'evt-seen' ? { id: 'evt-seen' } : null)),
        },
      }));
      expect(await replayService.isDurableDuplicate('evt-seen')).toBe(true);
      expect(await replayService.isDurableDuplicate('evt-new')).toBe(false);
      prisma.__resetGetPrismaForTests();
    });
  });

  describe('P1 session cleanup', () => {
    it('cleans routeSnapshot sidecar keys and records metrics', async () => {
      const updateMany = vi.fn(async () => ({ count: 1 }));
      prisma.__setGetPrismaForTests(async () => ({
        v3CallSession: {
          findUnique: vi.fn(async () => ({
            routeSnapshot: {
              routingModule: 'pstn',
              ivr: { active: true },
              queue: { queueId: 'q1' },
              conference: { id: 'c1' },
              holdTransfer: { holdActive: true },
            },
            version: 2,
          })),
          updateMany,
        },
      }));

      const result = await sessionCleanup.cleanupSessionSidecars({
        sessionId: 'sess-1',
        tenantId: 'tenant-a',
      });
      expect(result.ok).toBe(true);
      expect(updateMany).toHaveBeenCalled();
      const snap = updateMany.mock.calls[0][0].data.routeSnapshot;
      expect(snap.ivr).toBeUndefined();
      expect(snap.queue).toBeUndefined();
      expect(snap.conference).toBeUndefined();
      expect(snap.holdTransfer.holdActive).toBe(false);
      prisma.__resetGetPrismaForTests();
    });
  });

  describe('P1 executor lease renewal', () => {
    it('exports renewCommandLease on outbox', () => {
      expect(typeof commandOutbox.renewCommandLease).toBe('function');
    });
  });

  describe('P1 timer integration', () => {
    it('registers sidecar timer handler', () => {
      sidecarCoordinator.resetSidecarCoordinatorForTests();
      sidecarCoordinator.registerSidecarCoordinator();
      expect(typeof timerService.scheduleTimer).toBe('function');
      expect(typeof timerService.registerExpireHandler).toBe('function');
    });
  });

  describe('P1 metrics', () => {
    it('records hardening metrics', async () => {
      metrics.tenantBootstrapSuccess({ source: 'did_lookup' });
      metrics.tenantBootstrapFailed({ reason: 'unknown_did' });
      metrics.sessionCleanupTotal({ reason: 'session_closed' }, 2);
      metrics.timerExecutionTotal({ timer_name: 'ivr-digit-timeout' });
      metrics.replayTotal({ scope: 'dlq' }, 3);
      metrics.outboxCleanupTotal({ status: 'ACKED' }, 5);
      metrics.executorLeaseRenewal({ worker_id: 'w1' });

      const text = await metrics.renderPrometheus();
      expect(text).toContain('tenant_bootstrap_success_total');
      expect(text).toContain('tenant_bootstrap_failed_total');
      expect(text).toContain('session_cleanup_total');
      expect(text).toContain('timer_execution_total');
      expect(text).toContain('replay_total');
      expect(text).toContain('outbox_cleanup_total');
      expect(text).toContain('executor_lease_renewal_total');
    });
  });
});
