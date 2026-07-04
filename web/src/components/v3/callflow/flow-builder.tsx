'use client';

import { useCallback, useRef, useState } from 'react';
import { Copy, Link2, Trash2 } from 'lucide-react';
import type { CallFlowDefinition, FlowEdge, FlowNode } from '@/lib/v3-api';

type NodeTypeMeta = { type: string; label: string; color: string; terminal?: boolean };

type Props = {
  definition: CallFlowDefinition;
  nodeTypes: NodeTypeMeta[];
  onChange: (definition: CallFlowDefinition) => void;
};

function edgePath(source: FlowNode, target: FlowNode) {
  const x1 = source.position.x + 120;
  const y1 = source.position.y + 36;
  const x2 = target.position.x;
  const y2 = target.position.y + 36;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function newNodeId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newEdgeId() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CallFlowBuilder({ definition, nodeTypes, onChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const metaByType = Object.fromEntries(nodeTypes.map((n) => [n.type, n]));

  const update = useCallback((next: CallFlowDefinition) => {
    onChange({ version: next.version || 1, nodes: next.nodes, edges: next.edges });
  }, [onChange]);

  function addNode(type: string) {
    const meta = metaByType[type];
    const node: FlowNode = {
      id: newNodeId(),
      type,
      label: meta?.label || type,
      position: { x: 80 + definition.nodes.length * 24, y: 80 + definition.nodes.length * 24 },
      data: {},
    };
    update({ ...definition, nodes: [...definition.nodes, node] });
    setSelectedId(node.id);
  }

  function duplicateSelected() {
    if (!selectedId) return;
    const node = definition.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    const copy: FlowNode = {
      ...node,
      id: newNodeId(),
      label: `${node.label} (copy)`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data },
    };
    update({ ...definition, nodes: [...definition.nodes, copy] });
    setSelectedId(copy.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    update({
      ...definition,
      nodes: definition.nodes.filter((n) => n.id !== selectedId),
      edges: definition.edges.filter((e) => e.source !== selectedId && e.target !== selectedId),
    });
    setSelectedId(null);
    setConnectFrom(null);
  }

  function onNodeMouseDown(e: React.MouseEvent, node: FlowNode) {
    if ((e.target as HTMLElement).closest('[data-connect]')) return;
    e.preventDefault();
    setSelectedId(node.id);
    setDrag({ id: node.id, ox: e.clientX - node.position.x, oy: e.clientY - node.position.y });
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    update({
      ...definition,
      nodes: definition.nodes.map((n) => n.id === drag.id
        ? { ...n, position: { x: e.clientX - drag.ox, y: e.clientY - drag.oy } }
        : n),
    });
  }

  function onCanvasMouseUp() {
    setDrag(null);
  }

  function toggleConnect(nodeId: string) {
    if (!connectFrom) {
      setConnectFrom(nodeId);
      setSelectedId(nodeId);
      return;
    }
    if (connectFrom === nodeId) {
      setConnectFrom(null);
      return;
    }
    const edge: FlowEdge = {
      id: newEdgeId(),
      source: connectFrom,
      target: nodeId,
      sourceHandle: 'default',
      label: 'default',
    };
    update({ ...definition, edges: [...definition.edges, edge] });
    setConnectFrom(null);
  }

  const selected = definition.nodes.find((n) => n.id === selectedId);

  return (
    <div className="flex h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Node</div>
        <div className="mt-2 space-y-1">
          {nodeTypes.map((nt) => (
            <button
              key={nt.type}
              type="button"
              onClick={() => addNode(nt.type)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: nt.color }} />
              {nt.label}
            </button>
          ))}
        </div>
        {selected && (
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Selected</div>
            <div className="text-sm font-medium">{selected.label}</div>
            <div className="flex gap-1">
              <button type="button" onClick={duplicateSelected} className="rounded border p-1.5" title="Duplicate"><Copy className="h-4 w-4" /></button>
              <button type="button" onClick={() => toggleConnect(selected.id)} className="rounded border p-1.5" title="Connect"><Link2 className="h-4 w-4" /></button>
              <button type="button" onClick={deleteSelected} className="rounded border p-1.5 text-rose-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
            {connectFrom && connectFrom !== selected.id && (
              <button type="button" onClick={() => toggleConnect(selected.id)} className="w-full rounded bg-indigo-600 px-2 py-1 text-xs text-white">
                Connect here
              </button>
            )}
            {connectFrom === selected.id && (
              <p className="text-xs text-indigo-600">Click target node to connect</p>
            )}
          </div>
        )}
      </aside>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-auto bg-[radial-gradient(circle,_#e2e8f0_1px,_transparent_1px)] bg-[size:20px_20px]"
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {definition.edges.map((edge) => {
            const source = definition.nodes.find((n) => n.id === edge.source);
            const target = definition.nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            return (
              <g key={edge.id}>
                <path d={edgePath(source, target)} stroke="#94a3b8" strokeWidth={2} fill="none" markerEnd="url(#arrow)" />
                <text x={(source.position.x + target.position.x) / 2 + 60} y={(source.position.y + target.position.y) / 2 + 30} className="fill-slate-500 text-[10px]">
                  {edge.label || edge.sourceHandle}
                </text>
              </g>
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>

        {definition.nodes.map((node) => {
          const meta = metaByType[node.type];
          const isSelected = selectedId === node.id;
          const isConnect = connectFrom === node.id;
          return (
            <div
              key={node.id}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => onNodeMouseDown(e, node)}
              onClick={() => setSelectedId(node.id)}
              className={`absolute w-[120px] cursor-grab select-none rounded-lg border-2 bg-white shadow-sm active:cursor-grabbing ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'} ${isConnect ? 'border-amber-500' : ''}`}
              style={{ left: node.position.x, top: node.position.y }}
            >
              <div className="rounded-t-md px-2 py-1 text-xs font-semibold text-white" style={{ background: meta?.color || '#64748b' }}>
                {node.label}
              </div>
              <div className="px-2 py-2 text-[10px] text-slate-500">{node.type}</div>
              <button
                type="button"
                data-connect
                onClick={(e) => { e.stopPropagation(); toggleConnect(node.id); }}
                className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border bg-white text-[10px] leading-none"
              >
                →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
