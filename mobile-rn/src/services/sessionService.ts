/**
 * Session lifecycle helpers — wraps authService for non-React callers.
 */
export {
  bootstrapSession,
  clearSession,
  fetchCurrentUser,
  login,
  logout,
} from '../auth/authService';
