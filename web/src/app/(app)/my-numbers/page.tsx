'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, Check, ExternalLink, Loader2, Phone, Plus, Settings2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { IconInput, SlideOverPanel } from '@/components/slide-over-panel';
import {
  getBillingConfig,
  getMyNumbers,
  updatePhoneNumberRouting,
  type BillingConfig,
  type OwnedNumber,
} from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import { formatPrice } from '@/lib/pricing';

const ROUTING_OPTIONS = [
  { value: 'tenant_default', label: 'Tenant default' },
  { value: 'forward', label: 'Call forwarding' },
  { value: 'ring_group', label: 'Ring group' },
  { value: 'ivr', label: 'IVR menu' },
];

function isExtensionManaged(number: OwnedNumber) {
  return Boolean(number.isExtensionManaged || number.extensionId);
}

function routingLabel(number: OwnedNumber) {
  return number.effectiveRoutingLabel || number.routingTypeLabel || 'Tenant default';
}

export default function MyNumbersPage() {
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [selected, setSelected] = useState<OwnedNumber | null>(null);
  const [form, setForm] = useState({
    label: '',
    routingType: 'tenant_default',
    forwardDestination: '',
    isActive: true,
  });

  async function load() {
    const [numbersRes, billingRes] = await Promise.all([getMyNumbers(), getBillingConfig()]);
    setNumbers(numbersRes.numbers || []);
    setBilling({
      platformFeeSetup: billingRes.platformFeeSetup,
      platformFeeMonthly: billingRes.platformFeeMonthly,
      platformFeeFirstMonth: billingRes.platformFeeFirstMonth,
      currency: billingRes.currency,
      stripeEnabled: billingRes.stripeEnabled,
      manualPaymentEnabled: billingRes.manualPaymentEnabled,
    });
  }

  useEffect(() => {
    load()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openEdit(number: OwnedNumber) {
    setSelected(number);
    setForm({
      label: number.label || '',
      routingType: number.routingType || 'tenant_default',
      forwardDestination: number.forwardDestination || '',
      isActive: number.isActive !== false,
    });
    setEditError('');
    setEditOpen(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || isExtensionManaged(selected)) return;

    setSaving(true);
    setEditError('');
    try {
      const res = await updatePhoneNumberRouting(selected.id, {
        label: form.label,
        routingType: form.routingType,
        forwardDestination: form.forwardDestination,
        isActive: form.isActive,
      });
      setNumbers((prev) => prev.map((n) => (n.id === selected.id ? res.number : n)));
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save number settings');
    } finally {
      setSaving(false);
    }
  }

  const monthlyTotal = numbers.reduce(
    (sum, n) => sum + (n.tenantMonthlyTotal ?? n.platformMonthly ?? billing?.platformFeeMonthly ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your numbers…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-900">My numbers</h2>
          <p className="text-sm text-slate-400">
            Number inventory, billing, and inbound routing. Assign DIDs to extensions under Phone System → Extensions.
          </p>
        </div>
        <Link href="/numbers" className="inline-flex items-center gap-2 btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          Buy more numbers
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Active numbers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{numbers.filter((n) => n.isActive !== false).length}</p>
        </div>
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Est. monthly total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatPrice(monthlyTotal)}</p>
        </div>
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Platform fee / number</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {billing ? formatPrice(billing.platformFeeMonthly) : '—'}/mo
          </p>
        </div>
      </div>

      <DataTable
        title="Number directory"
        data={numbers}
        getRowId={(n) => n.id}
        emptyMessage={
          <>
            <p>No numbers assigned yet.</p>
            <Link href="/numbers" className="mt-2 inline-block text-indigo-600 hover:text-indigo-500">
              Search and buy numbers →
            </Link>
          </>
        }
        columns={[
          {
            key: 'number',
            header: 'Phone number',
            sortable: true,
            render: (n) => (
              <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                <Phone className="h-4 w-4 text-indigo-400" />
                {formatPhoneNumber(n.numberFormatted || n.number)}
              </span>
            ),
          },
          {
            key: 'label',
            header: 'Label',
            sortable: true,
            sortValue: (n) => n.label || '',
            render: (n) => <span className="text-slate-700">{n.label || '—'}</span>,
          },
          {
            key: 'routingType',
            header: 'Routing type',
            sortable: true,
            sortValue: (n) => routingLabel(n),
            render: (n) => (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  isExtensionManaged(n)
                    ? 'bg-slate-100 text-slate-700 ring-slate-200'
                    : 'bg-indigo-50 text-indigo-700 ring-indigo-100'
                }`}
              >
                {routingLabel(n)}
              </span>
            ),
          },
          {
            key: 'destination',
            header: 'Destination / target',
            sortable: true,
            render: (n) => (
              <span className="text-slate-600">{n.destination || '—'}</span>
            ),
          },
          {
            key: 'isActive',
            header: 'Status',
            sortable: true,
            sortValue: (n) => (n.isActive !== false ? 'active' : 'suspended'),
            render: (n) =>
              n.isActive !== false ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  Suspended
                </span>
              ),
          },
          {
            key: 'tenantMonthlyTotal',
            header: 'Total / mo',
            sortable: true,
            sortValue: (n) =>
              n.tenantMonthlyTotal ?? (n.carrierMonthly ?? 0) + (n.platformMonthly ?? billing?.platformFeeMonthly ?? 0),
            render: (n) => {
              const platform = n.platformMonthly ?? billing?.platformFeeMonthly ?? null;
              const total = n.tenantMonthlyTotal ?? (n.carrierMonthly ?? 0) + (platform ?? 0);
              return <span className="font-medium text-indigo-700">{formatPrice(total)}</span>;
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (n) =>
              isExtensionManaged(n) ? (
                <button
                  type="button"
                  onClick={() => openEdit(n)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openEdit(n)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Edit routing
                </button>
              ),
          },
        ]}
      />

      {numbers.length ? (
        <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-indigo-400" />
          Employee → Extension → Primary DID → Device. DID assignment is only under Phone System → Extensions.
        </p>
      ) : null}

      <SlideOverPanel
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title={selected && isExtensionManaged(selected) ? 'Extension-managed number' : 'Edit number routing'}
        footer={
          selected && isExtensionManaged(selected) ? (
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                form="edit-number-form"
                disabled={saving}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={saving}
                className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )
        }
      >
        {selected ? (
          isExtensionManaged(selected) ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-900">{formatPhoneNumber(selected.number)}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">{routingLabel(selected)}</p>
                <p className="mt-2 text-slate-600">
                  This DID is part of the extension ownership chain. Routing and assignment are read-only here.
                </p>
                {selected.destination ? (
                  <p className="mt-2 text-slate-600">Destination: {selected.destination}</p>
                ) : null}
              </div>
              <Link
                href={`/phone-system/extensions?open=${selected.extensionId || ''}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <ExternalLink className="h-4 w-4" />
                Manage in Phone System → Extensions
              </Link>
            </div>
          ) : (
            <form id="edit-number-form" onSubmit={onSaveEdit} className="space-y-4">
              <p className="text-sm font-medium text-slate-900">{formatPhoneNumber(selected.number)}</p>

              <IconInput
                icon={Building2}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Label (e.g. Sales team, Main reception)"
              />

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-700">Routing type</span>
                <select
                  value={form.routingType}
                  onChange={(e) => setForm((f) => ({ ...f, routingType: e.target.value }))}
                  className="input-field block w-full py-3"
                >
                  {ROUTING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.routingType === 'forward' ? (
                <IconInput
                  icon={Phone}
                  value={form.forwardDestination}
                  onChange={(e) => setForm((f) => ({ ...f, forwardDestination: e.target.value }))}
                  placeholder="Forward destination (+1 mobile or landline)"
                />
              ) : null}

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm text-slate-700">Number is active (accepts inbound calls)</span>
              </label>

              {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
            </form>
          )
        ) : null}
      </SlideOverPanel>
    </div>
  );
}
