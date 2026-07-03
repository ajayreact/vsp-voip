'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Star } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { searchV3Directory, getV3Profile, updateV3Profile, type DirectoryContact, type SoftphoneProfile } from '@/lib/v3-api';

type Tab = 'all' | 'favorites' | 'recent' | 'speed';

export default function DirectoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<DirectoryContact[]>([]);
  const [speedDial, setSpeedDial] = useState<SoftphoneProfile['speedDial']>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (term?: string, activeTab?: Tab) => {
    const t = activeTab ?? tab;
    const res = await searchV3Directory({
      search: term ?? search,
      favorites: t === 'favorites',
      recent: t === 'recent',
      limit: 100,
    });
    setItems(res.items);
    setTotal(res.total);
    setSpeedDial(res.speedDial || []);
  }, [search, tab]);

  useEffect(() => {getMe()
      .then(() => load())
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load directory');
      })
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError('');
    try {
      await load(search, tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function onTabChange(next: Tab) {
    setTab(next);
    setSearching(true);
    try {
      await load(search, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setSearching(false);
    }
  }

  async function toggleFavorite(contact: DirectoryContact) {
    const profileRes = await getV3Profile();
    const ids = new Set(profileRes.profile.favoriteContactIds);
    if (ids.has(contact.contactId)) ids.delete(contact.contactId);
    else ids.add(contact.contactId);
    await updateV3Profile({ favoriteContactIds: [...ids] });
    await load(search, tab);
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
        title="Company Directory"
        description="Search colleagues by name, extension, department, DID, email, or device."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['all', 'favorites', 'recent', 'speed'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t === 'all' ? 'All' : t === 'favorites' ? 'Favorites' : t === 'recent' ? 'Recent' : 'Speed Dial'}
          </button>
        ))}
      </div>

      {tab !== 'speed' ? (
        <>
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
                placeholder="Search directory..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          <p className="text-xs text-slate-500">{total} contact{total === 1 ? '' : 's'}</p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Ext</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">DID</th>
                  <th className="px-4 py-3">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No contacts found.</td>
                  </tr>
                ) : (
                  items.map((c) => (
                    <tr key={c.contactId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => toggleFavorite(c)} title="Toggle favorite">
                          <Star className={`h-4 w-4 ${c.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </td>
                      <td className="px-4 py-3">{c.extensionNumber || '—'}</td>
                      <td className="px-4 py-3">{c.department || '—'}</td>
                      <td className="px-4 py-3">{c.did || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{c.deviceLabel || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {speedDial.length === 0 ? (
            <p className="text-sm text-slate-500">No speed dial entries configured. Set them via profile API.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {speedDial.map((entry) => (
                <li key={entry.slot} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-slate-700">Slot {entry.slot}</span>
                  <span className="text-slate-600">{entry.label || entry.number || entry.contactId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
