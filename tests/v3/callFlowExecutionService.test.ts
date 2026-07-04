import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowExecutionService = require('../../lib/v3/callFlowExecutionService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowNodeService = require('../../lib/v3/callFlowNodeService.js');

function buildMenuFlow() {
  const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
  const menu = callFlowNodeService.createNode('MENU', { x: 150, y: 0 }, {
    prompt: 'Press 1 for sales',
    options: [{ digit: '1', label: 'Sales' }],
  });
  const ext = callFlowNodeService.createNode('EXTENSION', { x: 300, y: 0 }, { extensionId: 'e1', extensionNumber: '101' });
  const end = callFlowNodeService.createNode('END', { x: 450, y: 0 });

  let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, menu, ext, end], edges: [] });
  def = callFlowNodeService.connectNodes(def, start.id, menu.id);
  def = callFlowNodeService.connectNodes(def, menu.id, ext.id, { sourceHandle: '1', label: '1' });
  def = callFlowNodeService.connectNodes(def, menu.id, end.id, { sourceHandle: 'default', label: 'default' });
  return def;
}

describe('V3 callFlowExecutionService', () => {
  it('executes menu branch by pressed digit', () => {
    const def = buildMenuFlow();
    const result = callFlowExecutionService.executePath(def, { pressedDigits: ['1'] });

    expect(result.ok).toBe(true);
    expect(result.path.some((s: { nodeType: string }) => s.nodeType === 'MENU')).toBe(true);
    expect(result.finalDestination?.type).toBe('extension');
    expect(result.finalDestination?.extensionId).toBe('e1');
  });

  it('executes business hours branching', () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const bh = callFlowNodeService.createNode('BUSINESS_HOURS', { x: 150, y: 0 });
    const open = callFlowNodeService.createNode('EXTENSION', { x: 300, y: -50 }, { extensionId: 'open-ext' });
    const closed = callFlowNodeService.createNode('VOICEMAIL', { x: 300, y: 50 }, { extensionId: 'vm-ext' });

    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, bh, open, closed], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, bh.id);
    def = callFlowNodeService.connectNodes(def, bh.id, open.id, { sourceHandle: 'open' });
    def = callFlowNodeService.connectNodes(def, bh.id, closed.id, { sourceHandle: 'closed' });

    const weekdayMorning = callFlowExecutionService.executePath(def, {
      currentTime: '2026-07-03T14:00:00.000Z',
      businessHours: {
        sun: ['00:00', '23:59'], mon: ['00:00', '23:59'], tue: ['00:00', '23:59'],
        wed: ['00:00', '23:59'], thu: ['00:00', '23:59'], fri: ['00:00', '23:59'], sat: ['00:00', '23:59'],
      },
    });

    expect(weekdayMorning.finalDestination?.type).toBe('extension');
  });

  it('detects loop during execution', () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const menu = callFlowNodeService.createNode('MENU', { x: 150, y: 0 });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, menu], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, menu.id);
    def = callFlowNodeService.connectNodes(def, menu.id, menu.id);

    const result = callFlowExecutionService.executePath(def, { pressedDigits: ['1', '1', '1', '1'] });
    expect(result.errors.some((e: { code: string }) => e.code === 'LOOP_DETECTED')).toBe(true);
  });
});
