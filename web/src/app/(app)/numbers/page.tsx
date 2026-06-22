'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Check, Search, ShoppingCart } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { useCart } from '@/context/cart-context';
import {
  getAreaCodes,
  getBillingConfig,
  getMyNumbers,
  searchNumbers,
  type AvailableNumber,
  type BillingConfig,
  type NumberSearchFilters,
  type OwnedNumber,
} from '@/lib/api';
import { SwitchField } from '@/components/switch-field';
import { formatPrice, perNumberPricing } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

const COUNTRIES = [{ code: 'US', label: 'United States (+1)' }];

const FEATURES = [
  { value: '', label: 'Any feature' },
  { value: 'voice', label: 'Voice' },
  { value: 'sms', label: 'SMS' },
  { value: 'mms', label: 'MMS' },
  { value: 'fax', label: 'Fax' },
  { value: 'emergency', label: 'Emergency' },
];

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'local', label: 'Local' },
  { value: 'toll_free', label: 'Toll-free' },
];

const SEARCH_BY = [
  { value: 'area_code', label: 'Area code', placeholder: 'Select…' },
  { value: 'locality', label: 'City / Region', placeholder: 'e.g. Chicago' },
  { value: 'state', label: 'State / Province', placeholder: 'e.g. IL' },
];

const PATTERN_TYPES = [
  { value: 'starts_with', label: 'Starts with' },
  { value: 'contains', label: 'Contains' },
  { value: 'ends_with', label: 'Ends with' },
];

const DEFAULT_FILTERS: NumberSearchFilters = {
  country: 'US',
  features: '',
  phoneNumberType: '',
  searchBy: 'area_code',
  searchValue: '',
  patternType: 'starts_with',
  patternValue: '',
  consecutive: undefined,
  limit: 50,
  bestEffort: true,
  quickship: true,
  reservable: true,
  excludeHeldNumbers: true,
};

export default function NumbersPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<NumberSearchFilters>(DEFAULT_FILTERS);
  const [areaCodes, setAreaCodes] = useState<string[]>([]);
  const [areaCodesLoading, setAreaCodesLoading] = useState(false);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [ownedNumbers, setOwnedNumbers] = useState<OwnedNumber[]>([]);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const { addItem, isInCart, count: cartCount } = useCart();

  const searchByMeta = SEARCH_BY.find((s) => s.value === filters.searchBy) || SEARCH_BY[0];

  useEffect(() => {
    if (filters.searchBy !== 'area_code') return;

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
  }, [filters.country, filters.searchBy]);

  function updateFilter<K extends keyof NumberSearchFilters>(key: K, value: NumberSearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const runSearch = useCallback(async (payload: NumberSearchFilters) => {
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const res = await searchNumbers(payload);
      setNumbers(res.availableNumbers || []);
      setCount(res.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setNumbers([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(DEFAULT_FILTERS);
    getMyNumbers()
      .then((res) => setOwnedNumbers(res.numbers || []))
      .catch(() => setOwnedNumbers([]));
    getBillingConfig()
      .then((res) =>
        setBilling({
          platformFeeSetup: res.platformFeeSetup,
          platformFeeMonthly: res.platformFeeMonthly,
          platformFeeFirstMonth: res.platformFeeFirstMonth,
          currency: res.currency,
          stripeEnabled: res.stripeEnabled,
          manualPaymentEnabled: res.manualPaymentEnabled,
        }),
      )
      .catch(() =>
        setBilling({
          platformFeeSetup: 0,
          platformFeeMonthly: 8,
          platformFeeFirstMonth: 8,
          currency: 'usd',
          stripeEnabled: false,
          manualPaymentEnabled: false,
        }),
      );
  }, [runSearch]);

  const ownedSet = new Set(ownedNumbers.map((n) => n.number));

  function onAddToCart(number: AvailableNumber) {
    if (isInCart(number.phoneNumber)) {
      void Swal.fire({
        title: 'Already in cart',
        text: `${number.phoneNumber} is already in your cart.`,
        icon: 'info',
        confirmButtonText: 'View cart',
        showCancelButton: true,
        cancelButtonText: 'Close',
        ...SWAL_THEME,
      }).then((result) => {
        if (result.isConfirmed) router.push('/cart');
      });
      return;
    }

    addItem(number, 'United States (+1)');
    void Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Added to cart',
      showConfirmButton: false,
      timer: 2000,
      ...SWAL_THEME,
    });
  }

  async function onSearch() {
    await runSearch(filters);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Buy Numbers</h2>
          <p className="text-sm text-slate-400">
            Search VSP-VOIP number inventory — leave filters blank to browse all available numbers
          </p>
        </div>
        {cartCount > 0 ? (
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-500/20"
          >
            <ShoppingCart className="h-4 w-4" />
            Cart ({cartCount})
          </Link>
        ) : null}
      </div>

      {ownedNumbers.length ? (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <h3 className="mb-3 font-medium text-slate-900">Your numbers</h3>
          <div className="flex flex-wrap gap-2">
            {ownedNumbers.map((n) => (
              <span
                key={n.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 ring-1 ring-indigo-200 ring-1 ring-indigo-500/30"
              >
                <Check className="h-3.5 w-3.5" />
                {n.number}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel-card p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Country *</label>
            <select
              value={filters.country}
              onChange={(e) => updateFilter('country', e.target.value)}
              className="w-full rounded-lg input-field"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Features</label>
            <select
              value={filters.features}
              onChange={(e) => updateFilter('features', e.target.value)}
              className="w-full rounded-lg input-field"
            >
              {FEATURES.map((f) => (
                <option key={f.value || 'any'} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Type</label>
            <select
              value={filters.phoneNumberType}
              onChange={(e) => updateFilter('phoneNumberType', e.target.value)}
              className="w-full rounded-lg input-field"
            >
              {TYPES.map((t) => (
                <option key={t.value || 'all'} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Search by</label>
            <select
              value={filters.searchBy}
              onChange={(e) => {
                updateFilter('searchBy', e.target.value as NumberSearchFilters['searchBy']);
                updateFilter('searchValue', '');
              }}
              className="w-full rounded-lg input-field"
            >
              {SEARCH_BY.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-700">{searchByMeta.label}</label>
            {filters.searchBy === 'area_code' ? (
              <select
                value={filters.searchValue}
                onChange={(e) => updateFilter('searchValue', e.target.value)}
                disabled={areaCodesLoading}
                className="w-full rounded-lg input-field disabled:opacity-50"
              >
                <option value="">Select…</option>
                {areaCodes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            ) : (
              <input
                value={filters.searchValue}
                onChange={(e) => updateFilter('searchValue', e.target.value)}
                placeholder={searchByMeta.placeholder}
                className="w-full rounded-lg input-field"
              />
            )}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Advanced search</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm text-slate-400">Phone number</label>
              <div className="flex gap-2">
                <select
                  value={filters.patternType}
                  onChange={(e) =>
                    updateFilter('patternType', e.target.value as NumberSearchFilters['patternType'])
                  }
                  className="w-40 shrink-0 rounded-lg input-field"
                >
                  {PATTERN_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <input
                  value={filters.patternValue}
                  onChange={(e) => updateFilter('patternValue', e.target.value)}
                  placeholder="Phrase or numbers"
                  className="min-w-0 flex-1 rounded-lg input-field"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Consecutive numbers</label>
              <input
                type="number"
                min={2}
                max={10}
                value={filters.consecutive ?? ''}
                onChange={(e) =>
                  updateFilter('consecutive', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="Optional"
                className="w-full rounded-lg input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Results limit</label>
              <input
                type="number"
                min={1}
                max={100}
                value={filters.limit}
                onChange={(e) => updateFilter('limit', Number(e.target.value))}
                className="w-full rounded-lg input-field"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SwitchField
            label="Best effort"
            checked={!!filters.bestEffort}
            onCheckedChange={(v) => updateFilter('bestEffort', v)}
            className="bg-white/50"
          />
          <SwitchField
            label="Quickship"
            checked={!!filters.quickship}
            onCheckedChange={(v) => updateFilter('quickship', v)}
            className="bg-white/50"
          />
          <SwitchField
            label="Reservable numbers"
            checked={!!filters.reservable}
            onCheckedChange={(v) => updateFilter('reservable', v)}
            className="bg-white/50"
          />
          <SwitchField
            label="Exclude held numbers"
            checked={!!filters.excludeHeldNumbers}
            onCheckedChange={(v) => updateFilter('excludeHeldNumbers', v)}
            className="bg-white/50"
          />
        </div>

        <button
          onClick={onSearch}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Searching…' : 'Search numbers'}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {searched ? (
        <DataTable
          title="Search results"
          data={numbers}
          getRowId={(n) => n.phoneNumber}
          emptyMessage="No numbers match these filters. Try clearing the area code or turning off Quickship."
          columns={[
            {
              key: 'phoneNumber',
              header: 'Number',
              sortable: true,
              render: (n) => <span className="font-medium text-slate-900">{n.phoneNumber}</span>,
            },
            {
              key: 'location',
              header: 'Location',
              sortable: true,
              sortValue: (n) => `${n.locality} ${n.state}`,
              render: (n) => `${n.locality}, ${n.state} (${n.country})`,
            },
            {
              key: 'phoneNumberType',
              header: 'Type',
              sortable: true,
              render: (n) => <span className="capitalize">{n.phoneNumberType.replace(/_/g, ' ')}</span>,
            },
            {
              key: 'features',
              header: 'Features',
              sortable: false,
              searchable: false,
              render: (n) => (
                <div className="flex flex-wrap gap-1">
                  {(n.features.length ? n.features : ['voice']).map((f) => (
                    <span key={f} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {f}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: 'price',
              header: 'Your price (1st mo)',
              sortable: true,
              sortValue: (n) =>
                billing ? perNumberPricing(n.upfrontCost, n.monthlyCost, billing).dueToday : 0,
              render: (n) => {
                const line = billing
                  ? perNumberPricing(n.upfrontCost, n.monthlyCost, billing)
                  : null;
                return (
                  <>
                    {line ? formatPrice(line.dueToday) : '—'}
                    {line ? (
                      <p className="text-xs text-slate-500">
                        then {formatPrice(line.recurringMonthly)}/mo
                      </p>
                    ) : null}
                  </>
                );
              },
            },
            {
              key: 'action',
              header: 'Action',
              searchable: false,
              sortable: false,
              render: (n) =>
                ownedSet.has(n.phoneNumber) ? (
                  <span className="inline-flex items-center gap-1 text-indigo-600">
                    <Check className="h-4 w-4" /> Assigned
                  </span>
                ) : isInCart(n.phoneNumber) ? (
                  <Link href="/cart" className="text-indigo-600 hover:text-indigo-500">
                    In cart →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddToCart(n)}
                    className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to cart
                  </button>
                ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
