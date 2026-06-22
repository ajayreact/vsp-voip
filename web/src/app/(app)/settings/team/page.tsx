'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import Swal from 'sweetalert2';
import { SettingsNav } from '@/components/settings-nav';
import { DataTable } from '@/components/data-table';
import {
  createTeamUser,
  getMe,
  getTenantUsers,
  isUnauthorizedError,
  type TenantTeamUser,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

function roleLabel(role: string) {
  if (role === 'TENANT_ADMIN') return 'Admin';
  if (role === 'TENANT_USER') return 'User';
  return role;
}

export default function TeamSettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [users, setUsers] = useState<TenantTeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    const res = await getTenantUsers();
    setUsers(res.users || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        if (user.role !== 'TENANT_ADMIN') {
          router.replace('/settings');
          return;
        }
        setRole(user.role);
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load team');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onAddUser() {
    const result = await Swal.fire({
      title: 'Add team member',
      html: `
        <input id="user-name" class="swal2-input" placeholder="Full name" />
        <input id="user-email" class="swal2-input" type="email" placeholder="Email" />
        <input id="user-password" class="swal2-input" type="password" placeholder="Temporary password" />
        <select id="user-role" class="swal2-input">
          <option value="TENANT_ADMIN">Admin — can manage billing and team</option>
          <option value="TENANT_USER">User — view calls and numbers</option>
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create user',
      preConfirm: () => {
        const name = (document.getElementById('user-name') as HTMLInputElement)?.value?.trim();
        const email = (document.getElementById('user-email') as HTMLInputElement)?.value?.trim();
        const password = (document.getElementById('user-password') as HTMLInputElement)?.value;
        const userRole = (document.getElementById('user-role') as HTMLSelectElement)?.value;
        if (!name || !email || !password) {
          Swal.showValidationMessage('Name, email, and password are required');
          return false;
        }
        if (password.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters');
          return false;
        }
        return { name, email, password, role: userRole };
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await createTeamUser(result.value);
      await reload();
      await Swal.fire({
        title: 'User created',
        text: `${result.value.email} can sign in to your organization portal.`,
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Could not create user',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading team…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Team settings unavailable</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <p className="mt-3 text-xs text-slate-500">
          Restart the API server on port 3000 if you recently added team features.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Organization profile and team</p>
      </div>

      <SettingsNav role={role || undefined} />

      <DataTable
        title="Team members"
        data={users}
        getRowId={(user) => user.id}
        emptyMessage="No team members yet."
        footer="Admins can place orders and manage billing. Users can view calls, numbers, and greeting."
        action={
          <button type="button" onClick={onAddUser} className="btn-primary px-3 py-1.5 text-sm">
            <UserPlus className="h-4 w-4" />
            Add new record
          </button>
        }
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortable: true,
            render: (user) => <span className="font-medium text-slate-900">{user.name}</span>,
          },
          { key: 'email', header: 'Email', sortable: true },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (user) => (
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  user.role === 'TENANT_ADMIN'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {roleLabel(user.role)}
              </span>
            ),
          },
          {
            key: 'createdAt',
            header: 'Added',
            sortable: true,
            sortValue: (user) => new Date(user.createdAt),
            render: (user) => new Date(user.createdAt).toLocaleDateString(),
          },
        ]}
      />
    </div>
  );
}
