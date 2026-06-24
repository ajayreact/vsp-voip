'use client';

import { useEffect, useState } from 'react';
import { getMe, getVoicemails, isUnauthorizedError, type VoicemailRecord } from '@/lib/api';
import { VoicemailList } from '@/components/voicemail-list';

type VoicemailTabProps = {
  onUnreadCountChange?: (count: number) => void;
};

export function VoicemailTab({ onUnreadCountChange }: VoicemailTabProps) {
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canDeleteVoicemail, setCanDeleteVoicemail] = useState(false);

  useEffect(() => {
    getMe()
      .then((user) => {
        setCanDeleteVoicemail(
          user.role === 'TENANT_ADMIN' || user.role === 'SUPER_ADMIN',
        );
      })
      .catch(() => {});
  }, []);

  const loadMedia = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getVoicemails(100);
      setVoicemails(res.voicemails);
      onUnreadCountChange?.(res.voicemails.filter((vm) => !vm.isRead).length);
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(err instanceof Error ? err.message : 'Could not load voicemails');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pb-3 pt-2">
        <h1 className="text-[34px] font-bold tracking-tight text-[#1D1D1F]">Voicemail</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error ? <p className="mb-3 text-sm text-[#FF3B30]">{error}</p> : null}
        {loading ? (
          <p className="py-16 text-center text-sm text-[#8E8E93]">Loading voicemail…</p>
        ) : (
          <VoicemailList
            voicemails={voicemails}
            onChange={() => void loadMedia()}
            onError={setError}
            canDelete={canDeleteVoicemail}
          />
        )}
      </div>
    </div>
  );
}
