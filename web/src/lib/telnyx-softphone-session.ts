import type { RefObject } from 'react';
import type { IClientOptions } from '@telnyx/webrtc';
import { logSoftphone, warnSoftphone } from '@/lib/telnyx-debug';

export const REMOTE_AUDIO_ELEMENT_ID = 'softphone-remote-audio';

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
    debug: true,
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
