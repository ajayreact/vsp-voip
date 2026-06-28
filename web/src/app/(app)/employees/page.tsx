'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, Pencil, Phone, Hash, Smartphone } from 'lucide-react';
import Swal from 'sweetalert2';
import { PortalPageHeader } from '@/components/portal/page-header';
import { DataTable } from '@/components/data-table';
import {
  createTeamUser,
  getExtensions,
  getMe,
  getTenantUsers,
  isUnauthorizedError,
  type ExtensionRecord,
  type TenantTeamUser,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function EmployeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<TenantTeamUser[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);

  async function reload() {
    const [usersRes, extRes] = await Promise.all([
      getTenantUsers(),
      getExtensions().catch(() => ({ extensions: [] as ExtensionRecord[] })),
    ]);
    setUsers(usersRes.users || []);
    setExtensions(extRes.extensions || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load employees');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onCreateEmployee() {
    const result = await Swal.fire({
      title: 'Create employee',
      html: `
        <input id="user-name" class="swal2-input" placeholder="Full name" />
        <input id="user-email" class="swal2-input" type="email" placeholder="Email" />
        <input id="user-password" class="swal2-input" type="password" placeholder="Temporary password" />
        <select id="user-role" class="swal2-input">
          <option value="TENANT_USER">Employee — mobile app user</option>
          <option value="TENANT_ADMIN">Administrator</option>
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create',
      preConfirm: () => {
        const name = (document.getElementById('user-name') as HTMLInputElement)?.value?.trim();
        const email = (document.getElementById('user-email') as HTMLInputElement)?.value?.trim();
        const password = (document.getElementById('user-password') as HTMLInputElement)?.value;
        const role = (document.getElementById('user-role') as HTMLSelectElement)?.value;
        if (!name || !email || !password) {
          Swal.showValidationMessage('Name, email, and password are required');
          return false;
        }
        return { name, email, password, role };
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await createTeamUser(result.value);
      await reload();
      await Swal.fire({
        title: 'Employee created',
        text: 'Assign an extension and scan the QR code from the Extensions page to provision their mobile app.',
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Could not create employee',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  function extensionForUser(userId: string) {
    return extensions.find((ext) => ext.userId === userId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading employees…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Employees"
        description="Manage people who use your phone system. Assign extensions and DIDs from the Extensions page."
        actions={
          <button
            type="button"
            onClick={onCreateEmployee}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Create employee
          </button>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <DataTable
        title="All employees"
        data={users}
        getRowId={(user) => user.id}
        emptyMessage="No employees yet. Create one to assign an extension."
        columns={[
          {
            key: 'name',
            header: 'Name',
            sortable: true,
            render: (user) => (
              <div>
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (user) => (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {user.role === 'TENANT_ADMIN' ? 'Administrator' : 'Employee'}
              </span>
            ),
          },
          {
            key: 'extension',
            header: 'Extension',
            render: (user) => {
              const ext = user.assignedExtension || extensionForUser(user.id);
              if (!ext) {
                return (
                  <Link
                    href={`/extensions?open=${extensions.find((e) => !e.userId)?.id || ''}&tab=employee`}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Assign extension
                  </Link>
                );
              }
              return (
                <Link href={`/extensions?open=${ext.id}`} className="text-sm text-indigo-600 hover:text-indigo-700">
                  Ext {ext.extensionNumber}
                </Link>
              );
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            render: (user) => {
              const ext = user.assignedExtension || extensionForUser(user.id);
              return (
                <div className="flex flex-wrap gap-1">
                  <Link
                    href={ext ? `/extensions?open=${ext.id}&tab=employee` : '/extensions?create=1'}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  {ext ? (
                    <>
                      <Link
                        href={`/extensions?open=${ext.id}&tab=sip`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Config
                      </Link>
                      <Link
                        href={`/extensions?open=${ext.id}&tab=qr`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        QR
                      </Link>
                      <Link
                        href="/phone-numbers"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Hash className="h-3.5 w-3.5" />
                        DID
                      </Link>
                    </>
                  ) : null}
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
