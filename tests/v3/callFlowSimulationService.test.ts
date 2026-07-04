import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowSimulationService = require('../../lib/v3/callFlowSimulationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowNodeService = require('../../lib/v3/callFlowNodeService.js');

describe('V3 callFlowSimulationService', () => {
  it('returns execution path and final destination', async () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const ext = callFlowNodeService.createNode('EXTENSION', { x: 200, y: 0 }, { extensionId: 'e1' });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, ext], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, ext.id);

    const result = await callFlowSimulationService.simulateFlow(null, null, def, {
      incomingDid: '+15551230001',
      pressedDigits: [],
    });

    expect(result.executionPath.length).toBeGreaterThan(0);
    expect(result.finalDestination?.type).toBe('extension');
    expect(result.input.incomingDid).toBe('+15551230001');
  });

  it('simulation is idempotent for same input', async () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const end = callFlowNodeService.createNode('END', { x: 200, y: 0 });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, end], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, end.id);

    const input = { currentTime: '2026-07-03T10:00:00.000Z' };
    const first = await callFlowSimulationService.simulateFlow(null, null, def, input);
    const second = await callFlowSimulationService.simulateFlow(null, null, def, input);

    expect(second.executionPath).toEqual(first.executionPath);
    expect(second.finalDestination).toEqual(first.finalDestination);
  });
});
