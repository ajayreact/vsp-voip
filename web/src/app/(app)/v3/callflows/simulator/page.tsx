'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  getV3CallFlow,
  getV3CallFlows,
  isV3PortalEnabled,
  simulateV3CallFlow,
  type CallFlow,
  type CallFlowSimulationStep,
} from '@/lib/v3-api';

export default function V3CallFlowSimulatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flows, setFlows] = useState<CallFlow[]>([]);
  const [selectedId, setSelectedId] = useState(initialId || '');
  const [did, setDid] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [digits, setDigits] = useState('');
  const [running, setRunning] = useState(false);
  const [path, setPath] = useState<CallFlowSimulationStep[]>([]);
  const [finalDest, setFinalDest] = useState<Record<string, unknown> | null>(null);
  const [simErrors, setSimErrors] = useState<Array<{ message: string }>>([]);
  const [simWarnings, setSimWarnings] = useState<Array<{ message: string }>>([]);

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getV3CallFlows();
      })
      .then((res) => {
        if (!res) return;
        setFlows(res.items || []);
        if (initialId) setSelectedId(initialId);
        else if (res.items?.[0]) setSelectedId(res.items[0].id);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [router, initialId]);

  useEffect(() => {
    if (!selectedId) return;
    getV3CallFlow(selectedId)
      .then((res) => setDid(res.callFlow.did || ''))
      .catch(() => {});
  }, [selectedId]);

  async function onSimulate() {
    if (!selectedId) return;
    setRunning(true);
    setError('');
    try {
      const result = await simulateV3CallFlow({
        callFlowId: selectedId,
        input: {
          incomingDid: did || undefined,
          currentTime: currentTime || new Date().toISOString(),
          pressedDigits: digits.replace(/\s/g, '').split('').filter(Boolean),
        },
      });
      setPath(result.executionPath || []);
      setFinalDest(result.finalDestination);
      setSimErrors(result.errors || []);
      setSimWarnings(result.warnings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Call Flow Simulator"
        description="Test execution paths without placing live calls."
        actions={
          <button
            type="button"
            onClick={onSimulate}
            disabled={running || !selectedId}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Run Simulation
          </button>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Input</h3>
          <label className="block text-sm">
            Call Flow
            <select className="mt-1 w-full rounded border px-3 py-2" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select flow</option>
              {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Incoming DID
            <input className="mt-1 w-full rounded border px-3 py-2" value={did} onChange={(e) => setDid(e.target.value)} placeholder="+15551230001" />
          </label>
          <label className="block text-sm">
            Current Time (ISO)
            <input className="mt-1 w-full rounded border px-3 py-2" value={currentTime} onChange={(e) => setCurrentTime(e.target.value)} placeholder={new Date().toISOString()} />
          </label>
          <label className="block text-sm">
            Pressed Digits
            <input className="mt-1 w-full rounded border px-3 py-2" value={digits} onChange={(e) => setDigits(e.target.value)} placeholder="12" />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Output</h3>
          {finalDest && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="font-medium text-emerald-800">Final Destination</div>
              <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(finalDest, null, 2)}</pre>
            </div>
          )}
          {simErrors.length > 0 && (
            <ul className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 list-disc pl-5">
              {simErrors.map((e, i) => <li key={i}>{e.message}</li>)}
            </ul>
          )}
          {simWarnings.length > 0 && (
            <ul className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 list-disc pl-5">
              {simWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
            </ul>
          )}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Execution Path</div>
            {path.map((step, i) => (
              <div key={i} className="rounded border px-3 py-2 text-sm">
                <div className="font-medium">{i + 1}. {step.label} <span className="text-slate-400">({step.nodeType})</span></div>
                {step.detail && Object.keys(step.detail).length > 0 && (
                  <pre className="mt-1 text-xs text-slate-600">{JSON.stringify(step.detail)}</pre>
                )}
              </div>
            ))}
            {!path.length && <p className="text-sm text-slate-500">Run simulation to see execution path.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
