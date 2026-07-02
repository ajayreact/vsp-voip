'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { CallFlowBuilder } from '@/components/v3/callflow/flow-builder';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  getV3CallFlow,
  getV3CallFlowNodeTypes,
  isV3PortalEnabled,
  updateV3CallFlow,
  validateV3CallFlow,
  type CallFlow,
  type CallFlowDefinition,
  type CallFlowValidationIssue,
} from '@/lib/v3-api';

export default function V3CallFlowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<CallFlow | null>(null);
  const [definition, setDefinition] = useState<CallFlowDefinition>({ version: 1, nodes: [], edges: [] });
  const [nodeTypes, setNodeTypes] = useState<Array<{ type: string; label: string; color: string }>>([]);
  const [validation, setValidation] = useState<{ valid: boolean; errors: CallFlowValidationIssue[]; warnings: CallFlowValidationIssue[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    if (!flowId) {
      router.replace('/v3/callflows');
      return;
    }
    getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([getV3CallFlow(flowId), getV3CallFlowNodeTypes()]);
      })
      .then((res) => {
        if (!res) return;
        const [flowRes, typesRes] = res;
        setFlow(flowRes.callFlow);
        setDefinition(flowRes.callFlow.definition);
        setNodeTypes(typesRes.nodeTypes || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [router, flowId]);

  const onDefinitionChange = useCallback((def: CallFlowDefinition) => {
    setDefinition(def);
    setValidation(null);
  }, []);

  async function onSave() {
    if (!flowId || !flow) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateV3CallFlow(flowId, { definition, name: flow.name, did: flow.did || undefined });
      setFlow(res.callFlow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onValidate() {
    if (!flowId) return;
    setError('');
    try {
      const report = await validateV3CallFlow({ callFlowId: flowId, definition });
      setValidation({ valid: report.valid, errors: report.errors, warnings: report.warnings });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
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
        title={flow ? `Builder — ${flow.name}` : 'Flow Builder'}
        description="Drag nodes, connect edges, validate before publish. No live routing."
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={onValidate} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4" /> Validate
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      {validation && (
        <div className={`rounded-lg border p-3 text-sm ${validation.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <div className="font-medium">{validation.valid ? 'Flow is valid' : 'Validation issues found'}</div>
          {validation.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {validation.errors.map((e, i) => <li key={`e-${i}`}>{e.message}</li>)}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-amber-800">
              {validation.warnings.map((w, i) => <li key={`w-${i}`}>{w.message}</li>)}
            </ul>
          )}
        </div>
      )}

      <CallFlowBuilder definition={definition} nodeTypes={nodeTypes} onChange={onDefinitionChange} />
    </div>
  );
}
