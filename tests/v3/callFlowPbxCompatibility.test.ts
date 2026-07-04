import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowValidationService = require('../../lib/v3/callFlowValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowNodeService = require('../../lib/v3/callFlowNodeService.js');

describe('V3 call flow PBX reference compatibility', () => {
  it('validates V3 ring group and queue references', async () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const rg = callFlowNodeService.createNode('RING_GROUP', { x: 150, y: 0 }, { ringGroupId: 'rg-v3-1' });
    const q = callFlowNodeService.createNode('QUEUE', { x: 300, y: 0 }, { queueId: 'q-v3-1' });
    const end = callFlowNodeService.createNode('END', { x: 450, y: 0 });

    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, rg, q, end], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, rg.id);
    def = callFlowNodeService.connectNodes(def, rg.id, q.id);
    def = callFlowNodeService.connectNodes(def, q.id, end.id);

    const prisma = {
      v3RingGroup: { findFirst: vi.fn(async () => ({ id: 'rg-v3-1' })) },
      v3Queue: { findFirst: vi.fn(async () => ({ id: 'q-v3-1' })) },
      ringGroup: { findFirst: vi.fn(async () => null) },
      extension: { findFirst: vi.fn(async () => null) },
      v3VoicemailBox: { findFirst: vi.fn(async () => null) },
      v3BusinessHoursSchedule: { findFirst: vi.fn(async () => null) },
      v3Holiday: { findFirst: vi.fn(async () => null) },
      greeting: { findFirst: vi.fn(async () => null) },
    };

    const report = await callFlowValidationService.validateFlow(prisma, 't1', def);
    const refErrors = report.errors.filter((e: { code: string }) => e.code === 'MISSING_RING_GROUP' || e.code === 'MISSING_QUEUE');
    expect(refErrors).toEqual([]);
  });
});
