'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/stat-card';
import { DataTable } from '@/components/data-table';
import { getDashboardStats, getMe, type NumberOrder, type User } from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { orderStatusBadgeClass, orderStatusLabel, orderStatusTone } from '@/lib/orderStatus';
import { getSoftphoneHref } from '@/lib/softphone-config';

export default function DashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    Promise.all([getDashboardStats(), getMe()])
      .then(([dashboardStats, me]) => {
        setStats(dashboardStats);
        setUser(me);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="hero-banner overflow-hidden p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-indigo-50">Dashboard</p>
              <h2 className="text-2xl font-semibold text-white">
                Welcome back, {user?.name?.split(' ')[0] || 'there'}
              </h2>
              <p className="mt-1 text-sm text-indigo-50">
                Your cloud phone activity at a glance
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-indigo-100">Total Calls</p>
                <p className="text-2xl font-semibold text-indigo-200">{stats?.callCount ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-indigo-100">Numbers</p>
                <p className="text-2xl font-semibold text-sky-200">{stats?.numberCount ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-indigo-100">Open Orders</p>
                <p className="text-2xl font-semibold text-amber-200">{stats?.pendingOrdersCount ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-indigo-100">Unread SMS</p>
                <p className="text-2xl font-semibold text-rose-200">{stats?.unreadSmsCount ?? '—'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/my-numbers" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                My numbers
              </Link>
              <Link href={getSoftphoneHref()} className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                Open softphone
              </Link>
            </div>
          </div>
          <div className="hidden h-28 w-28 items-center justify-center rounded-full bg-white/10 text-5xl lg:flex">
            📞
          </div>
        </div>
      </div>

      {(stats?.pendingOrdersCount ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-900">
            You have {stats?.pendingOrdersCount} order{(stats?.pendingOrdersCount ?? 0) === 1 ? '' : 's'} awaiting payment or fulfillment.
          </p>
          <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
            View orders in Settings →
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Calls" value={stats?.callCount ?? '—'} accent="green" />
        <StatCard label="Phone Numbers" value={stats?.numberCount ?? '—'} accent="blue" />
        <StatCard label="Open Orders" value={stats?.pendingOrdersCount ?? '—'} accent="orange" />
        <StatCard label="Unread Voicemail" value={stats?.unreadVoicemailCount ?? '—'} accent="red" />
        <StatCard label="Unread SMS" value={stats?.unreadSmsCount ?? '—'} accent="indigo" />
        <StatCard label="Platform" value="Live" accent="green" hint="Voice platform connected" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/numbers" className="btn-secondary px-4 py-2 text-sm">
          Buy numbers
        </Link>
        <Link href="/sms" className="btn-secondary px-4 py-2 text-sm">
          SMS inbox
        </Link>
        <Link href="/voicemail" className="btn-secondary px-4 py-2 text-sm">
          Voicemail
        </Link>
        <Link href="/recordings" className="btn-secondary px-4 py-2 text-sm">
          Recordings
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable
          title="Recent orders"
          data={stats?.recentOrders || []}
          getRowId={(order) => order.id}
          defaultPageSize={5}
          pageSizeOptions={[5, 10, 25]}
          emptyMessage="No orders yet"
          columns={[
            {
              key: 'createdAt',
              header: 'Date',
              sortable: true,
              sortValue: (order) => new Date(order.createdAt),
              render: (order) => new Date(order.createdAt).toLocaleDateString(),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (order) => {
                const tone = orderStatusTone(order.status);
                return (
                  <span className={`rounded-full px-2 py-1 text-xs ${orderStatusBadgeClass(tone)}`}>
                    {orderStatusLabel(order)}
                  </span>
                );
              },
            },
            {
              key: 'totalCharged',
              header: 'Total',
              sortable: true,
              sortValue: (order) => order.totalCharged,
              render: (order) => formatPrice(order.totalCharged),
            },
          ]}
        />

        <DataTable
          title="Recent calls"
          data={stats?.recentCalls || []}
          getRowId={(call) => call.id}
          defaultPageSize={5}
          pageSizeOptions={[5, 10, 25]}
          emptyMessage="No calls yet — place a test call to your number"
          columns={[
            { key: 'from', header: 'From', sortable: true },
            { key: 'to', header: 'To', sortable: true },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (call) => (
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{call.status}</span>
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
    </div>
  );
}
