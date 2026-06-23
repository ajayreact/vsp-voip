'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Search, ShoppingCart, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  checkoutNumbers,
  getAdminOrders,
  getAdminTenants,
  getAreaCodes,
  getConnections,
  getMe,
  isUnauthorizedError,
  searchNumbers,
  type AdminTenant,
  type AvailableNumber,
  type NumberOrder,
  type NumberSearchFilters,
} from '@/lib/api';
import { calculateTenantPricing, formatPrice, perNumberPricing } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

const COUNTRIES = [{ code: 'US', label: 'United States (+1)' }];

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'local', label: 'Local' },
  { value: 'toll_free', label: 'Toll-free' },
];

const DEFAULT_FILTERS: NumberSearchFilters = {
  country: 'US',
  features: '',
  phoneNumberType: '',
  searchBy: 'area_code',
  searchValue: '',
  patternType: 'starts_with',
  patternValue: '',
  limit: 50,
  bestEffort: true,
  quickship: true,
  reservable: true,
  excludeHeldNumbers: true,
};

function tenantBillingConfig(tenant: AdminTenant | null) {
  if (!tenant) return null;
  return {
    platformFeeSetup: tenant.platformFeeSetup,
    platformFeeMonthly: tenant.platformFeeMonthly,
    platformFeeFirstMonth: tenant.platformFeeFirstMonth ?? tenant.platformFeeMonthly,
    currency: 'USD',
    stripeEnabled: false,
    manualPaymentEnabled: false,
  };
}

export default function AdminNumberPurchasePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [filters, setFilters] = useState<NumberSearchFilters>(DEFAULT_FILTERS);
  const [areaCodes, setAreaCodes] = useState<string[]>([]);
  const [areaCodesLoading, setAreaCodesLoading] = useState(false);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [cart, setCart] = useState<AvailableNumber[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<NumberOrder[]>([]);
  const [billTenantAutomatically, setBillTenantAutomatically] = useState(false);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId],
  );
  const billing = useMemo(() => tenantBillingConfig(selectedTenant), [selectedTenant]);
  const cartSet = useMemo(() => new Set(cart.map((n) => n.phoneNumber)), [cart]);
  const cartPricing = useMemo(
    () => (billing && cart.length ? calculateTenantPricing(cart, billing) : null),
    [billing, cart],
  );

  const loadRecentOrders = useCallback(async () => {
    const res = await getAdminOrders({});
    setRecentOrders((res.orders || []).slice(0, 8));
  }, []);

  useEffect(() => {
    getMe()
      .then(async (user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        const [tenantsRes, connectionsRes] = await Promise.all([
          getAdminTenants(),
          getConnections(),
        ]);
        setTenants(tenantsRes.tenants || []);
        setConnectionId(connectionsRes.defaultConnectionId);
        await loadRecentOrders();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router, loadRecentOrders]);

  useEffect(() => {
    let cancelled = false;
    setAreaCodesLoading(true);
    getAreaCodes(filters.country)
      .then((res) => {
        if (!cancelled) setAreaCodes(res.areaCodes || []);
      })
      .catch(() => {
        if (!cancelled) setAreaCodes([]);
      })
      .finally(() => {
        if (!cancelled) setAreaCodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.country]);

  function updateFilter<K extends keyof NumberSearchFilters>(key: K, value: NumberSearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSelected(phoneNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visible = numbers.filter((n) => !cartSet.has(n.phoneNumber));
    const allSelected = visible.every((n) => selected.has(n.phoneNumber));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const n of visible) {
        if (allSelected) next.delete(n.phoneNumber);
        else next.add(n.phoneNumber);
      }
      return next;
    });
  }

  function addToCart(items: AvailableNumber[]) {
    setCart((prev) => {
      const existing = new Set(prev.map((n) => n.phoneNumber));
      const merged = [...prev];
      for (const item of items) {
        if (!existing.has(item.phoneNumber)) merged.push(item);
      }
      return merged;
    });
    setSelected(new Set());
  }

  function addSelectedToCart() {
    const toAdd = numbers.filter((n) => selected.has(n.phoneNumber) && !cartSet.has(n.phoneNumber));
    if (!toAdd.length) return;
    addToCart(toAdd);
    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `${toAdd.length} added to cart`,
      showConfirmButton: false,
      timer: 1800,
      ...SWAL_THEME,
    });
  }

  function removeFromCart(phoneNumber: string) {
    setCart((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
  }

  async function onSearch() {
    setSearching(true);
    setError('');
    try {
      const res = await searchNumbers(filters);
      setNumbers(res.availableNumbers || []);
      setSearched(true);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function onBuyNow() {
    if (!tenantId) {
      await Swal.fire({
        title: 'Select a tenant',
        text: 'Choose which organization receives the purchased numbers.',
        icon: 'warning',
        ...SWAL_THEME,
      });
      return;
    }
    if (!cart.length) {
      await Swal.fire({
        title: 'Cart is empty',
        text: 'Add numbers to the cart before purchasing.',
        icon: 'info',
        ...SWAL_THEME,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Direct purchase — revenue impact',
      html: `
        <div style="text-align:left;font-size:0.875rem;line-height:1.5">
          <p style="margin:0 0 12px">
            You are purchasing <strong>${cart.length}</strong> number(s) for
            <strong>${selectedTenant?.name ?? 'tenant'}</strong>.
          </p>
          <p style="margin:0 0 12px;padding:10px 12px;background:#fef3c7;border-radius:8px;color:#92400e">
            <strong>Warning:</strong> The platform pays Telnyx immediately. Without billing enabled,
            the tenant is not charged and revenue is lost.
          </p>
          ${
            cartPricing
              ? `<p style="color:#64748b;margin:0 0 8px">
                  Platform cost (est.): ${formatPrice(cartPricing.carrierUpfront)} setup +
                  ${formatPrice(cartPricing.recurringMonthly)}/mo carrier MRC
                </p>`
              : ''
          }
          ${
            billTenantAutomatically
              ? `<p style="margin:0;color:#059669">
                  ✓ Bill tenant automatically — invoice & receivable will be created.
                </p>`
              : `<p style="margin:0;color:#dc2626">
                  ✗ Tenant will NOT be billed unless you enable "Bill tenant automatically".
                </p>`
          }
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      ...SWAL_THEME,
      confirmButtonText: billTenantAutomatically ? 'Purchase & bill tenant' : 'Purchase (platform pays)',
      confirmButtonColor: billTenantAutomatically ? '#4f46e5' : '#d97706',
    });
    if (!confirm.isConfirmed) return;

    setBuying(true);
    try {
      const res = await checkoutNumbers(
        cart.map((n) => n.phoneNumber),
        {
          connectionId: connectionId || undefined,
          tenantId,
          items: cart,
          billTenantAutomatically,
        },
      );

      if (res.failed?.length) {
        await Swal.fire({
          title: res.purchased?.length ? 'Partial success' : 'Purchase failed',
          html: res.failed.map((f) => `${f.phoneNumber}: ${f.error}`).join('<br/>'),
          icon: res.purchased?.length ? 'warning' : 'error',
          ...SWAL_THEME,
        });
      } else {
        await Swal.fire({
          title: 'Purchase complete',
          text: res.message,
          icon: 'success',
          ...SWAL_THEME,
        });
      }

      const purchasedSet = new Set((res.purchased || []).map((p) => p.phoneNumber));
      setCart((prev) => prev.filter((n) => !purchasedSet.has(n.phoneNumber)));
      await loadRecentOrders();
      if (res.purchased?.length) {
        await onSearch();
      }
    } catch (err) {
      await Swal.fire({
        title: 'Purchase failed',
        text: err instanceof Error ? err.message : 'Could not complete purchase',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Numbers"
        title="Search & buy numbers"
        subtitle="Search Telnyx inventory and purchase numbers for any tenant. Uses the same backend flow as the tenant portal."
      />

      <div className="panel-card p-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Assign to tenant *
        </label>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="input-field w-full max-w-md"
        >
          <option value="">Select tenant…</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.numberCount} numbers)
            </option>
          ))}
        </select>
        {selectedTenant && billing ? (
          <p className="mt-2 text-xs text-slate-500">
            Platform fees: {formatPrice(billing.platformFeeSetup)} setup ·{' '}
            {formatPrice(billing.platformFeeMonthly)}/mo per number
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="panel-card p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm text-slate-700">Country</label>
                <select
                  value={filters.country}
                  onChange={(e) => updateFilter('country', e.target.value)}
                  className="input-field w-full"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-700">Area code</label>
                <select
                  value={filters.searchValue || ''}
                  onChange={(e) => updateFilter('searchValue', e.target.value)}
                  className="input-field w-full"
                  disabled={areaCodesLoading}
                >
                  <option value="">Any area code</option>
                  {areaCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-slate-700">Number type</label>
                <select
                  value={filters.phoneNumberType || ''}
                  onChange={(e) => updateFilter('phoneNumberType', e.target.value)}
                  className="input-field w-full"
                >
                  {TYPES.map((t) => (
                    <option key={t.value || 'all'} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={onSearch}
                  disabled={searching}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  {searching ? 'Searching…' : 'Search Telnyx'}
                </button>
              </div>
            </div>

            {searched && numbers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {numbers.filter((n) => !cartSet.has(n.phoneNumber)).every((n) => selected.has(n.phoneNumber))
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
                {selected.size > 0 ? (
                  <>
                    <button type="button" onClick={addSelectedToCart} className="btn-primary px-3 py-1.5 text-sm">
                      Add {selected.size} selected to cart
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Clear selection
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {searched ? (
            <DataTable
              title="Telnyx search results"
              data={numbers}
              getRowId={(n) => n.phoneNumber}
              emptyMessage="No numbers match these filters."
              columns={[
                {
                  key: 'select',
                  header: 'Select',
                  searchable: false,
                  sortable: false,
                  render: (n) =>
                    cartSet.has(n.phoneNumber) ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(n.phoneNumber)}
                        onChange={() => toggleSelected(n.phoneNumber)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    ),
                },
                {
                  key: 'phoneNumber',
                  header: 'Number',
                  sortable: true,
                  render: (n) => <span className="font-mono font-medium">{n.phoneNumber}</span>,
                },
                {
                  key: 'location',
                  header: 'Location',
                  sortable: true,
                  sortValue: (n) => `${n.locality} ${n.state}`,
                  render: (n) => `${n.locality}, ${n.state}`,
                },
                {
                  key: 'phoneNumberType',
                  header: 'Type',
                  sortable: true,
                  render: (n) => <span className="capitalize">{n.phoneNumberType.replace(/_/g, ' ')}</span>,
                },
                {
                  key: 'setup',
                  header: 'Setup',
                  sortable: true,
                  sortValue: (n) => Number(n.upfrontCost) || 0,
                  render: (n) => formatPrice(n.upfrontCost),
                },
                {
                  key: 'mrc',
                  header: 'MRC',
                  sortable: true,
                  sortValue: (n) => Number(n.monthlyCost) || 0,
                  render: (n) => (
                    <>
                      {formatPrice(n.monthlyCost)}
                      {billing ? (
                        <p className="text-xs text-slate-500">
                          tenant {formatPrice(perNumberPricing(n.upfrontCost, n.monthlyCost, billing).recurringMonthly)}
                          /mo
                        </p>
                      ) : null}
                    </>
                  ),
                },
                {
                  key: 'action',
                  header: 'Cart',
                  searchable: false,
                  sortable: false,
                  render: (n) =>
                    cartSet.has(n.phoneNumber) ? (
                      <span className="text-emerald-600 text-sm">In cart</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart([n])}
                        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add
                      </button>
                    ),
                },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">Run a search to browse Telnyx inventory.</p>
          )}
        </div>

        <aside className="panel-card h-fit space-y-4 p-5 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Purchase cart</h3>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {cart.length}
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-500">Select numbers and add them to the cart.</p>
          ) : (
            <>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {cart.map((n) => (
                  <li
                    key={n.phoneNumber}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div>
                      <p className="font-mono text-slate-900">{n.phoneNumber}</p>
                      <p className="text-xs text-slate-500">
                        Setup {formatPrice(n.upfrontCost)} · MRC {formatPrice(n.monthlyCost)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(n.phoneNumber)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {cartPricing ? (
                <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Carrier setup</span>
                    <span>{formatPrice(cartPricing.carrierUpfront)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Platform setup</span>
                    <span>{formatPrice(cartPricing.platformUpfront + cartPricing.platformFirstMonth)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-900">
                    <span>Due today (est.)</span>
                    <span>{formatPrice(cartPricing.dueToday)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>MRC (est.)</span>
                    <span>{formatPrice(cartPricing.recurringMonthly)}/mo</span>
                  </div>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={billTenantAutomatically}
                  onChange={(e) => setBillTenantAutomatically(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <span className="font-medium text-slate-900">Bill tenant automatically</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Creates invoice, receivable, and margin record. Recommended for revenue protection.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={onBuyNow}
                disabled={buying || !tenantId}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
              >
                {buying ? 'Purchasing…' : 'Buy now & assign'}
              </button>
            </>
          )}
        </aside>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-slate-900">Recent purchase history</h3>
          <Link href="/admin/numbers/history" className="text-sm text-indigo-600 hover:text-indigo-500">
            View all →
          </Link>
        </div>
        <DataTable
          title="Latest orders"
          data={recentOrders}
          getRowId={(o) => o.id}
          defaultPageSize={5}
          emptyMessage="No orders yet."
          columns={[
            {
              key: 'createdAt',
              header: 'Date',
              sortable: true,
              sortValue: (o) => new Date(o.createdAt),
              render: (o) => new Date(o.createdAt).toLocaleString(),
            },
            { key: 'tenantName', header: 'Tenant', sortable: true, render: (o) => o.tenantName || '—' },
            {
              key: 'phoneNumbers',
              header: 'Numbers',
              render: (o) => (
                <span className="text-xs text-slate-600">
                  {Array.isArray(o.phoneNumbers) ? o.phoneNumbers.length : 0} number(s)
                </span>
              ),
            },
            {
              key: 'totalCharged',
              header: 'Total',
              sortable: true,
              render: (o) => formatPrice(o.totalCharged),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (o) => (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{o.status.toLowerCase()}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              searchable: false,
              sortable: false,
              render: (o) => (
                <Link href={`/admin/orders/${o.id}`} className="text-sm text-indigo-600 hover:text-indigo-500">
                  Details
                </Link>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
