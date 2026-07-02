import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowValidationService = require('../../lib/v3/callFlowValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowNodeService = require('../../lib/v3/callFlowNodeService.js');

function buildLinearFlow(types: string[]) {
  const nodes = types.map((type, i) => callFlowNodeService.createNode(type, { x: i * 150, y: 0 }));
  let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes, edges: [] });
  for (let i = 0; i < nodes.length - 1; i += 1) {
    def = callFlowNodeService.connectNodes(def, nodes[i].id, nodes[i + 1].id);
  }
  return def;
}

describe('V3 callFlowValidationService', () => {
  it('detects missing start node', async () => {
    const end = callFlowNodeService.createNode('END', { x: 0, y: 0 });
    const report = await callFlowValidationService.validateFlow(null, null, { version: 1, nodes: [end], edges: [] });
    expect(report.valid).toBe(false);
    expect(report.errors.some((e: { code: string }) => e.code === 'MISSING_START')).toBe(true);
  });

  it('detects loops', async () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const menu = callFlowNodeService.createNode('MENU', { x: 150, y: 0 });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, menu], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, menu.id);
    def = callFlowNodeService.connectNodes(def, menu.id, start.id);

    const cycles = callFlowValidationService.detectCycles(def);
    expect(cycles.length).toBeGreaterThan(0);

    const report = await callFlowValidationService.validateFlow(null, null, def);
    expect(report.errors.some((e: { code: string }) => e.code === 'LOOP_DETECTED')).toBe(true);
  });

  it('detects dead-end routing nodes', async () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const menu = callFlowNodeService.createNode('MENU', { x: 150, y: 0 });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, menu], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, menu.id);

    const deadEnds = callFlowValidationService.findDeadEndNodes(def);
    expect(deadEnds.some((n: { type: string }) => n.type === 'MENU')).toBe(true);

    const report = await callFlowValidationService.validateFlow(null, null, def);
    expect(report.errors.some((e: { code: string }) => e.code === 'DEAD_END')).toBe(true);
  });

  it('detects disconnected nodes', async () => {
    const flow = buildLinearFlow(['START', 'END']);
    const orphan = callFlowNodeService.createNode('EXTENSION', { x: 400, y: 0 });
    const def = { ...flow, nodes: [...flow.nodes, orphan] };

    const unreachable = callFlowValidationService.findUnreachableNodes(def);
    expect(unreachable).toContain(orphan.id);
  });

  it('validation is idempotent', async () => {
    const flow = buildLinearFlow(['START', 'PLAY_GREETING', 'END']);
    flow.nodes[1].data = { greetingText: 'Welcome' };

    const first = await callFlowValidationService.validateFlow(null, null, flow);
    const second = await callFlowValidationService.validateFlow(null, null, flow);
    expect(second).toEqual(first);
  });
});
