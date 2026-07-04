import { useCallback, useEffect, useState } from 'react';
import {
  loadAuthPreferences,
  saveAuthPreferences,
  type AuthPreferences,
} from '../auth/authPreferences';
import { getBiometricCapability } from '../auth/biometricAuth';

export function useAuthPreferences() {
  const [prefs, setPrefs] = useState<AuthPreferences | null>(null);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [loaded, capability] = await Promise.all([
        loadAuthPreferences(),
        getBiometricCapability(),
      ]);
      setPrefs(loaded);
      setBiometricLabel(capability.label);
      setBiometricAvailable(capability.available);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updatePrefs = useCallback(async (partial: Partial<AuthPreferences>) => {
    await saveAuthPreferences(partial);
    setPrefs((current) => (current ? { ...current, ...partial } : current));
  }, []);

  return {
    prefs,
    loading,
    biometricLabel,
    biometricAvailable,
    reload,
    updatePrefs,
  };
}
