'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Forward, Loader2, Trash2 } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { AuthenticatedAudioPlayer } from '@/components/authenticated-audio-player';
import { AiSummaryCard } from '@/components/ai/ai-summary-card';
import { TranscriptCard } from '@/components/ai/transcript-card';
import { VoicemailAudioScope } from '@/components/voicemail-audio-scope';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  deleteVoicemail,
  getExtensions,
  getMe,
  getTenantProfile,
  getVoicemails,
  isUnauthorizedError,
  markVoicemailRead,
  type ExtensionRecord,
  type VoicemailRecord,
} from '@/lib/api';
import { downloadAuthenticatedFile } from '@/lib/media-download';
import { formatPhoneNumber } from '@/lib/phone';
import { SWAL_THEME } from '@/lib/swal-theme';

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

type VoicemailRow = VoicemailRecord & {
  extensionNumber: string;
};

export function VoicemailManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [voicemails, setVoicemails] = useState<VoicemailRow[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');

  const extensionById = useMemo(
    () => new Map(extensions.map((ext) => [ext.id, ext])),
    [extensions],
  );

  const reload = useCallback(async () => {
    const [vmRes, extRes] = await Promise.all([getVoicemails(100), getExtensions()]);
    setExtensions(extRes.extensions || []);
    const extMap = new Map((extRes.extensions || []).map((e) => [e.id, e]));
    setVoicemails(
      (vmRes.voicemails || []).map((vm) => ({
        ...vm,
        extensionNumber: vm.extensionId
          ? extMap.get(vm.extensionId)?.extensionNumber || '—'
          : '—',
      })),
    );
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setIsAdmin(user.role === 'TENANT_ADMIN' || user.role === 'SUPER_ADMIN');
        return Promise.all([reload(), getTenantProfile().catch(() => null)]);
      })
      .then((res) => {
        const profileRes = res?.[1];
        if (profileRes?.profile?.contactEmail) {
          setContactEmail(profileRes.profile.contactEmail);
        }
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load voicemails');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  async function onPlay(vm: VoicemailRecord) {
    setExpandedId(vm.id);
    if (!vm.isRead) {
      try {
        await markVoicemailRead(vm.id);
        setVoicemails((prev) =>
          prev.map((item) => (item.id === vm.id ? { ...item, isRead: true } : item)),
        );
      } catch {
        /* ignore */
      }
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this voicemail?')) return;
    try {
      await deleteVoicemail(id);
      setVoicemails((prev) => prev.filter((item) => item.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function onDownload(vm: VoicemailRecord) {
    try {
      await downloadAuthenticatedFile(
        `/api/tenant/voicemails/${vm.id}/stream`,
        `voicemail-${vm.id}.mp3`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function onForward(vm: VoicemailRow) {
    const ext = vm.extensionId ? extensionById.get(vm.extensionId) : undefined;
    const result = await Swal.fire({
      title: 'Forward voicemail',
      html: `
        <p style="font-size:14px;color:#475569;margin-bottom:8px">Send a notification email with caller details.</p>
        <input id="fwd-email" class="swal2-input" style="margin:0" placeholder="recipient@company.com" value="${contactEmail}" />
      `,
      showCancelButton: true,
      confirmButtonText: 'Open email',
      preConfirm: () => {
        const email = (document.getElementById('fwd-email') as HTMLInputElement)?.value?.trim();
        if (!email) {
          Swal.showValidationMessage('Enter an email address');
          return false;
        }
        return email;
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;

    const subject = encodeURIComponent(`Voicemail from ${formatPhoneNumber(vm.from)}`);
    const body = encodeURIComponent(
      `Voicemail received ${new Date(vm.createdAt).toLocaleString()}\n`
        + `Caller: ${formatPhoneNumber(vm.from)}\n`
        + `Extension: ${ext?.extensionNumber || vm.extensionNumber || '—'}\n`
        + `Duration: ${formatDuration(vm.durationSeconds)}\n\n`
        + `Listen in the tenant portal under Voicemail.`,
    );
    window.location.href = `mailto:${result.value}?subject=${subject}&body=${body}`;
  }

  const unreadCount = voicemails.filter((vm) => !vm.isRead).length;

  const columns: DataTableColumn<VoicemailRow>[] = [
    {
      key: 'from',
      header: 'Caller',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          {formatPhoneNumber(row.from)}
          {!row.isRead ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">New</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt),
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: 'durationSeconds',
      header: 'Duration',
      sortable: true,
      sortValue: (row) => row.durationSeconds ?? -1,
      render: (row) => formatDuration(row.durationSeconds),
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) =>
        row.extensionId ? (
          <Link href={`/extensions?open=${row.extensionId}`} className="text-indigo-600 hover:text-indigo-700">
            {row.extensionNumber}
          </Link>
        ) : (
          row.extensionNumber
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onPlay(row)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => onDownload(row)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            type="button"
            onClick={() => onForward(row)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Forward className="h-3.5 w-3.5" />
            Forward
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading voicemails…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Voicemail"
        description="Messages left when calls are not answered. Administration only."
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Total messages</p>
          <p className="mt-1 text-2xl font-semibold">{voicemails.length}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Unread</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-600">{unreadCount}</p>
        </div>
      </div>

      <VoicemailAudioScope>
        <DataTable
          title="Voicemail inbox"
          data={voicemails}
          getRowId={(row) => row.id}
          emptyMessage="No voicemails yet. Enable voicemail in call routing to collect messages."
          columns={columns}
        />

        {expandedId ? (
          <div className="space-y-4">
            <div className="panel-card p-4">
              <p className="text-sm font-medium text-slate-900">Playback</p>
              <AuthenticatedAudioPlayer
                streamPath={`/api/tenant/voicemails/${expandedId}/stream`}
                className="mt-3 w-full max-w-md"
                playerId={expandedId}
                onPlay={() => {
                  const vm = voicemails.find((v) => v.id === expandedId);
                  if (vm && !vm.isRead) onPlay(vm);
                }}
              />
            </div>
            <TranscriptCard entityType="voicemail" entityId={expandedId} />
            <AiSummaryCard entityType="voicemail" entityId={expandedId} />
          </div>
        ) : null}
      </VoicemailAudioScope>
    </div>
  );
}
