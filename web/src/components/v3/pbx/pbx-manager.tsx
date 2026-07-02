'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';

export type PbxField = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'textarea' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export type PbxItem = Record<string, unknown> & { id: string };

type Props = {
  title: string;
  description: string;
  fields: PbxField[];
  nameKey: string;
  listItems: (search?: string) => Promise<{ items: PbxItem[] }>;
  createItem: (data: Record<string, unknown>) => Promise<{ item: PbxItem }>;
  updateItem: (id: string, data: Record<string, unknown>) => Promise<{ item: PbxItem }>;
  deleteItem: (id: string) => Promise<unknown>;
  validateItem: (data: Record<string, unknown>) => Promise<{ valid: boolean; errors: Array<{ message: string }>; warnings: Array<{ message: string }> }>;
  emptyForm: Record<string, unknown>;
  formatRow?: (item: PbxItem) => string;
};

export function PbxManager({
  title,
  description,
  fields,
  nameKey,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  validateItem,
  emptyForm,
  formatRow,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PbxItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [validation, setValidation] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listItems(search || undefined)
      .then((res) => {
        if (active) setItems(res.items || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Load failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [listItems, search]);

  async function reload() {
    const res = await listItems(search || undefined);
    setItems(res.items || []);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setValidation('');
  }

  function openEdit(item: PbxItem) {
    setEditingId(item.id);
    setForm({ ...emptyForm, ...item });
    setShowForm(true);
    setValidation('');
  }

  async function onValidate() {
    setValidation('');
    try {
      const report = await validateItem({ ...form, id: editingId });
      setValidation(report.valid
        ? `Valid${report.warnings?.length ? ` (${report.warnings.length} warning(s))` : ''}`
        : report.errors.map((e) => e.message).join('; '));
    } catch (err) {
      setValidation(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingId) await updateItem(editingId, form);
      else await createItem(form);
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this item?')) return;
    try {
      await deleteItem(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
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
        title={title}
        description={description}
        actions={
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> Create
          </button>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="flex gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" onClick={() => reload()} className="rounded border px-3 py-2 text-sm">Filter</button>
      </div>

      {showForm && (
        <form onSubmit={onSave} className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium">{editingId ? 'Edit' : 'Create'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="text-sm block">
                {f.label}
                {f.type === 'select' ? (
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
                    rows={3}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : f.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="ml-2"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({
                      ...form,
                      [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                    })}
                  />
                )}
              </label>
            ))}
          </div>
          {validation && <p className="text-sm text-slate-600">{validation}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onValidate} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4" /> Validate
            </button>
            <button type="submit" disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{String(item[nameKey] || item.id)}</td>
                <td className="px-4 py-3 text-slate-600">{formatRow ? formatRow(item) : item.id}</td>
                <td className="px-4 py-3 space-x-2">
                  <button type="button" onClick={() => openEdit(item)} className="text-indigo-600 hover:underline">Edit</button>
                  <button type="button" onClick={() => onDelete(item.id)} className="text-rose-600 hover:underline">
                    <Trash2 className="inline h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

export { parseJsonArray };
