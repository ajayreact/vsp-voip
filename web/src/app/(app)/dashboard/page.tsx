'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, Users, Phone, Hash, Smartphone, UsersRound } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { DataTable } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, type User } from '@/lib/api';
import { loadPortalDashboardSnapshot, type PortalDashboardSnapshot } from '@/lib/portal-dashboard';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [snapshot, setSnapshot] = useState<PortalDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => {
        setUser(me);
        const isAdmin = me.role === 'TENANT_ADMIN' || me.role === 'SUPER_ADMIN';
        return loadPortalDashboardSnapshot(isAdmin);
      })
      .then(setSnapshot)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  const quickLinks = [
    { href: '/employees', label: 'Employees', icon: Users },
    { href: '/extensions', label: 'Extensions', icon: Phone },
    { href: '/phone-numbers', label: 'Phone numbers', icon: Hash },
    { href: '/devices', label: 'Devices', icon: Smartphone },
    { href: '/ring-groups', label: 'Ring groups', icon: UsersRound },
  ];

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] || 'Administrator'}`}
        description="Enterprise PBX administration — manage extensions, employees, and phone numbers. Use the mobile app for calling."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Active employees" value={snapshot?.activeEmployees ?? '—'} accent="indigo" />
        <StatCard label="Registered devices" value={snapshot?.registeredDevices ?? '—'} accent="blue" />
        <StatCard label="Active calls" value={snapshot?.activeCalls ?? 0} accent="green" hint="Live sessions" />
        <StatCard label="Phone numbers" value={snapshot?.phoneNumbers ?? '—'} accent="blue" />
        <StatCard label="Extensions" value={snapshot?.extensions ?? '—'} accent="indigo" />
        <StatCard label="Ring groups" value={snapshot?.ringGroups ?? '—'} accent="orange" />
        <StatCard label="Unread voicemail" value={snapshot?.unreadVoicemail ?? 0} accent="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel-card p-5 lg:col-span-1">
          <h2 className="section-title">Quick access</h2>
          <ul className="mt-4 space-y-2">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-indigo-600" />
                    {label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-card p-5 lg:col-span-2">
          <h2 className="section-title">Call statistics</h2>
          <p className="mt-1 text-sm text-slate-500">Based on recent call history (read-only).</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Total calls</p>
              <p className="text-2xl font-semibold text-slate-900">{snapshot?.totalCalls ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inbound (sample)</p>
              <p className="text-2xl font-semibold text-blue-600">{snapshot?.callStats.inbound ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Outbound (sample)</p>
              <p className="text-2xl font-semibold text-emerald-600">{snapshot?.callStats.outbound ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Online extensions</p>
              <p className="text-2xl font-semibold text-indigo-600">{snapshot?.onlineExtensions ?? 0}</p>
            </div>
          </div>
          <Link href="/reports" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View full reports →
          </Link>
        </div>
      </div>

      <DataTable
        title="Recent calls"
        data={snapshot?.recentCalls || []}
        getRowId={(call) => call.id}
        defaultPageSize={8}
        emptyMessage="No calls yet"
        action={
          <Link href="/calls" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View all
          </Link>
        }
        columns={[
          { key: 'from', header: 'From', sortable: true },
          { key: 'to', header: 'To', sortable: true },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (call) => (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{call.status}</span>
            ),
          },
          {
            key: 'createdAt',
            header: 'Time',
            sortable: true,
            sortValue: (call) => new Date(call.createdAt),
            render: (call) => new Date(call.createdAt).toLocaleString(),
          },
        ]}
      />
    </div>
  );
}
