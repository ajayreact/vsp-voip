'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, ShoppingCart } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { isV3PortalEnabled, purchaseV3Number, searchV3Marketplace } from '@/lib/v3-api';
import { runV3SuperAdminGuard } from '@/components/v3/ops/ops-ui';

type SearchResult = { phoneNumber: string; locality: string; state: string; monthlyCost: string | null };

export default function V3MarketplacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    runV3SuperAdminGuard(router)
      .then((user) => {
        if (user) setAuthorized(true);
        else router.replace('/dashboard');
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError('');
    try {
      const res = await searchV3Marketplace({ country: 'US', searchBy: 'area_code', searchValue: areaCode, limit: 25 });
      setResults(res.availableNumbers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function onPurchase(number: SearchResult, reserveOnly = false) {
    setMessage('');
    try {
      const res = await purchaseV3Number({
        phoneNumber: number.phoneNumber,
        monthlyCost: number.monthlyCost || undefined,
        reserveOnly,
      });
      setMessage(reserveOnly
        ? `Reserved ${res.reserved?.number}`
        : `Purchased ${res.number?.number} → ${res.number?.inventoryStatus}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Number Marketplace"
        description="Super Admin: search Telnyx, reserve, and purchase numbers into platform inventory."
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <form onSubmit={onSearch} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          placeholder="Area code (e.g. 512)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={searching} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Monthly</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Search to find available numbers.</td></tr>
            ) : results.map((row) => (
              <tr key={row.phoneNumber} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{row.phoneNumber}</td>
                <td className="px-4 py-3">{row.locality}, {row.state}</td>
                <td className="px-4 py-3">{row.monthlyCost ? `$${row.monthlyCost}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onPurchase(row, true)} className="rounded border border-slate-300 px-2 py-1 text-xs">Reserve</button>
                    <button type="button" onClick={() => onPurchase(row, false)} className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs text-white">
                      <ShoppingCart className="h-3 w-3" /> Purchase
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
