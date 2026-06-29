import { useEffect, useState } from 'react';
import { loadStoredSipProfile } from '../sip/storage';
import { useAuth } from './useAuth';
import { useCallingStore } from '../store/callingStore';
import { usePhoneConnection } from './usePhoneConnection';

export function useCallerProfile() {
  const { user } = useAuth();
  const defaultCallerId = useCallingStore((s) => s.defaultCallerId);
  const { label: registrationLabel, status, canPlaceCalls } = usePhoneConnection();
  const [extension, setExtension] = useState('');

  useEffect(() => {
    void loadStoredSipProfile().then((profile) => {
      if (profile?.extension) setExtension(profile.extension);
    });
  }, []);

  return {
    name: user?.name || 'User',
    email: user?.email || '',
    tenantName: user?.tenantName || '',
    extension,
    businessDid: defaultCallerId,
    registrationLabel,
    registrationStatus: status,
    isRegistered: canPlaceCalls,
  };
}
