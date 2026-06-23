'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio } from 'lucide-react';
import { login, setToken } from '@/lib/api';

function isAdminHost(hostname: string) {
  return hostname === 'admin.vspphone.com' || hostname.startsWith('admin.');
}

export default function LoginPage() {
  const router = useRouter();
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const adminPortal = isAdminHost(window.location.hostname);
    setIsAdminPortal(adminPortal);

    if (process.env.NODE_ENV !== 'development') return;

    if (adminPortal) {
      setEmail('superadmin@vsp-voip.com');
      setPassword('Super@123');
    } else {
      setEmail('admin@asuitech.com');
      setPassword('Admin@123');
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      setToken(res.accessToken);
      router.push(res.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-indigo-600">VSP-VOIP</h1>
            <p className="text-sm text-slate-500">
              {isAdminPortal
                ? 'Sign in to the admin console'
                : 'Sign in to your tenant portal'}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                isAdminPortal ? 'superadmin@vsp-voip.com' : 'you@company.com'
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-indigo-500/30 focus:ring-2"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <p className="text-right text-sm">
            <a href="/forgot-password" className="text-indigo-600 hover:underline">Forgot password?</a>
          </p>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full px-4 py-2.5 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
