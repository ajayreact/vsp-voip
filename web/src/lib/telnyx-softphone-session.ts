import type { RefObject } from 'react';
import type { IClientOptions } from '@telnyx/webrtc';
import { logSoftphone, warnSoftphone } from '@/lib/telnyx-debug';

export const REMOTE_AUDIO_ELEMENT_ID = 'softphone-remote-audio';
export const TELNYX_TOKEN_EXPIRING_SOON_CODE = 34001;

/** Wait until the remote audio element is mounted (required before TelnyxRTC.connect). */
export function waitForRemoteAudioElement(
  ref: RefObject<HTMLAudioElement | null>,
  elementId = REMOTE_AUDIO_ELEMENT_ID,
  maxAttempts = 40,
): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      const fromRef = ref.current;
      const fromDom = document.getElementById(elementId) as HTMLAudioElement | null;
      const element = fromRef || fromDom;

      if (element) {
        if (!element.id) {
          element.id = elementId;
        }
        logSoftphone('Remote audio element ready', { id: element.id });
        resolve(element);
        return;
      }

      if (remaining <= 0) {
        reject(new Error(`Remote audio element #${elementId} was not found in the DOM`));
        return;
      }

      requestAnimationFrame(() => attempt(remaining - 1));
    };

    attempt(maxAttempts);
  });
}

export function buildTelnyxClientOptions(loginToken: string): IClientOptions {
  const trimmed = loginToken.trim();
  if (!trimmed) {
    throw new Error('Telnyx login token is empty');
  }

  const options: IClientOptions = {
    login_token: trimmed,
    debug: process.env.NODE_ENV === 'development',
    keepConnectionAliveOnSocketClose: true,
    trickleIce: true,
    prefetchIceCandidates: true,
  };

  const rtcRegion = process.env.NEXT_PUBLIC_TELNYX_RTC_REGION?.trim();
  if (rtcRegion) {
    options.region = rtcRegion;
  }

  return options;
}

export function bindRemoteAudioTarget(
  client: object,
  audioEl: HTMLAudioElement,
) {
  (client as { remoteElement?: HTMLMediaElement }).remoteElement = audioEl;
  audioEl.autoplay = true;
  audioEl.muted = false;
  audioEl.setAttribute('playsinline', 'true');
}

export function scheduleTelnyxReconnect(
  connect: () => void,
  tearingDown: () => boolean,
  delayMs = 1500,
): () => void {
  warnSoftphone(`Scheduling Telnyx reconnect in ${delayMs}ms`);
  const timerId = window.setTimeout(() => {
    if (tearingDown()) return;
    logSoftphone('Reconnecting TelnyxRTC after socket close');
    connect();
  }, delayMs);

  return () => window.clearTimeout(timerId);
}

type TelnyxTokenClient = {
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
  updateToken?: (token: string) => void;
};

export function bindTelnyxTokenLifecycle(
  client: TelnyxTokenClient,
  options: {
    fetchLoginToken: () => Promise<string>;
    expiresInSeconds?: number;
    isAborted?: () => boolean;
    onRefreshed?: () => void;
    onRefreshError?: (error: unknown) => void;
  },
): () => void {
  let refreshTimer: number | undefined;
  let refreshing = false;

  const refreshToken = async (reason: string) => {
    if (refreshing || options.isAborted?.()) return;
    refreshing = true;
    try {
      const newToken = (await options.fetchLoginToken()).trim();
      if (!newToken) {
        throw new Error('Empty login token from server');
      }
      if (typeof client.updateToken === 'function') {
        client.updateToken(newToken);
      } else {
        throw new Error('Telnyx client does not support updateToken');
      }
      logSoftphone('Telnyx login token refreshed', { reason });
      options.onRefreshed?.();
    } catch (error) {
      options.onRefreshError?.(error);
    } finally {
      refreshing = false;
    }
  };

  const onWarning = (warning: unknown) => {
    const code = (warning as { code?: number })?.code;
    if (code === TELNYX_TOKEN_EXPIRING_SOON_CODE) {
      void refreshToken('TOKEN_EXPIRING_SOON');
    }
  };

  client.on('telnyx.warning', onWarning);

  if (options.expiresInSeconds && options.expiresInSeconds > 0) {
    const refreshInMs = Math.max((options.expiresInSeconds - 3600) * 1000, 60_000);
    refreshTimer = window.setTimeout(() => {
      void refreshToken('scheduled');
    }, refreshInMs);
  }

  return () => {
    client.off('telnyx.warning', onWarning);
    if (refreshTimer != null) {
      window.clearTimeout(refreshTimer);
    }
  };
}
