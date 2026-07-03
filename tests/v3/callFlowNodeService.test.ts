import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowNodeService = require('../../lib/v3/callFlowNodeService.js');

describe('V3 callFlowNodeService', () => {
  it('creates independent nodes for each type', () => {
    const types = callFlowNodeService.listNodeTypes().map((n: { type: string }) => n.type);
    expect(types).toContain('START');
    expect(types).toContain('MENU');
    expect(types).toContain('END');
    expect(types.length).toBe(13);
  });

  it('connects and deletes nodes idempotently', () => {
    const start = callFlowNodeService.createNode('START', { x: 0, y: 0 });
    const end = callFlowNodeService.createNode('END', { x: 200, y: 0 });
    let def = callFlowNodeService.normalizeDefinition({ version: 1, nodes: [start, end], edges: [] });
    def = callFlowNodeService.connectNodes(def, start.id, end.id);

    const serialized1 = callFlowNodeService.serializeDefinition(def);
    const serialized2 = callFlowNodeService.serializeDefinition(serialized1);
    expect(serialized2).toEqual(serialized1);

    def = callFlowNodeService.deleteNode(def, start.id);
    expect(def.nodes).toHaveLength(1);
    expect(def.edges).toHaveLength(0);
  });

  it('duplicates a node with offset', () => {
    const node = callFlowNodeService.createNode('EXTENSION', { x: 100, y: 50 }, { extensionId: 'e1' });
    const copy = callFlowNodeService.duplicateNode(node);
    expect(copy.id).not.toBe(node.id);
    expect(copy.position.x).toBe(140);
    expect(copy.data.extensionId).toBe('e1');
  });
});
