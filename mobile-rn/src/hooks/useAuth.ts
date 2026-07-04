import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const awaitingBiometric = useAuthStore((state) => state.awaitingBiometric);
  const pendingBiometricOptIn = useAuthStore((state) => state.pendingBiometricOptIn);
  const biometricLabel = useAuthStore((state) => state.biometricLabel);
  const lastUsername = useAuthStore((state) => state.lastUsername);
  const error = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const unlockWithBiometric = useAuthStore((state) => state.unlockWithBiometric);
  const skipBiometricUnlock = useAuthStore((state) => state.skipBiometricUnlock);
  const login = useAuthStore((state) => state.login);
  const loginWithQrToken = useAuthStore((state) => state.loginWithQrToken);
  const provisionWithQr = useAuthStore((state) => state.provisionWithQr);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const markSessionExpired = useAuthStore((state) => state.markSessionExpired);
  const enableBiometricLogin = useAuthStore((state) => state.enableBiometricLogin);
  const declineBiometricLogin = useAuthStore((state) => state.declineBiometricLogin);
  const clearError = useAuthStore((state) => state.clearError);

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    isSubmitting,
    sessionExpired,
    awaitingBiometric,
    pendingBiometricOptIn,
    biometricLabel,
    lastUsername,
    error,
    bootstrap,
    unlockWithBiometric,
    skipBiometricUnlock,
    login,
    loginWithQrToken,
    provisionWithQr,
    logout,
    refreshUser,
    markSessionExpired,
    enableBiometricLogin,
    declineBiometricLogin,
    clearError,
  };
}
