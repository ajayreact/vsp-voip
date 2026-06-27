import { isApiError, isNotFoundError } from './errors';

const RAW_PATTERNS = [
  /axios/i,
  /network error/i,
  /json/i,
  /unexpected token/i,
  /404/,
  /500/,
  /502/,
  /503/,
  /fetch failed/i,
  /failed to fetch/i,
  /cannot reach api/i,
  /econnrefused/i,
  /enotfound/i,
  /timeout/i,
  /socket/i,
];

export function getFriendlyErrorMessage(error: unknown, context?: string): string {
  if (isNotFoundError(error)) {
    if (context === 'messages') {
      return 'Messaging is currently unavailable.';
    }
    return "We couldn't find what you're looking for.";
  }

  if (isApiError(error)) {
    if (error.status === 0) {
      return 'Connection lost. Check your network and try again.';
    }
    if (error.status >= 500) {
      return 'Something went wrong on our end. Please try again.';
    }
    if (error.status === 401) {
      return 'Authentication expired. Please sign in again.';
    }
    if (error.status === 403) {
      return "You don't have permission to do that.";
    }
    if (error.status === 422) {
      return context === 'calls'
        ? 'Unable to place call. Check the number and try again.'
        : 'Some information was invalid. Please review and try again.';
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/finish or end your current call/i.test(message)) {
    return 'Unable to place call. End your current call first.';
  }
  if (/phone is not connected/i.test(message)) {
    return 'Unable to place call. The phone is not connected. Please wait while we reconnect.';
  }
  if (/cannot make call when connection state/i.test(message)) {
    return 'Unable to place call. The phone is not connected. Please wait while we reconnect.';
  }
  if (/connection state is:\s*(error|connecting|disconnected|reconnecting|offline)/i.test(message)) {
    return 'Unable to place call. The phone is not connected. Please wait while we reconnect.';
  }
  if (/valid phone number or extension/i.test(message)) {
    return 'Enter a valid phone number or extension.';
  }
  if (/extension unavailable/i.test(message)) {
    return 'Extension unavailable.';
  }

  if (!message || RAW_PATTERNS.some((p) => p.test(message))) {
    if (context === 'messages') {
      return "Couldn't load messages.";
    }
    if (context === 'calls') {
      return 'Call failed. Please try again.';
    }
    if (context === 'contacts') {
      return "Couldn't load contacts.";
    }
    if (context === 'voicemail') {
      return "Couldn't load voicemail.";
    }
    if (context === 'dashboard') {
      return "Couldn't load your home screen.";
    }
    return 'Something went wrong. Please try again.';
  }

  return message;
}
