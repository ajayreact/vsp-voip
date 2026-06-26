import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const error = useAuthStore((state) => state.error);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const markSessionExpired = useAuthStore((state) => state.markSessionExpired);
  const clearError = useAuthStore((state) => state.clearError);

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    isSubmitting,
    sessionExpired,
    error,
    bootstrap,
    login,
    logout,
    refreshUser,
    markSessionExpired,
    clearError,
  };
}
