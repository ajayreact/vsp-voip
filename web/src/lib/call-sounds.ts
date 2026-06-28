import { logDiagnosticTimeline } from '@/lib/telephony/logger';

const RINGBACK_SRC = '/sounds/ringback.mp3';
const INCOMING_RING_SRC = '/sounds/incoming-ring.mp3';

let ringbackAudio: HTMLAudioElement | null = null;
let incomingRingAudio: HTMLAudioElement | null = null;
let webAudioContext: AudioContext | null = null;
let webAudioOscillator: OscillatorNode | null = null;
let webAudioGain: GainNode | null = null;
let webAudioTimer: number | null = null;

/** QA diagnostic — which local tone path is currently active. */
let activeLocalToneSource: 'none' | 'mp3' | 'web-audio-fallback' = 'none';

export function getActiveLocalToneSourceForDiagnostics() {
  return activeLocalToneSource;
}

function getOrCreateLoopAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  return audio;
}

function stopWebAudioTone() {
  if (webAudioOscillator || webAudioTimer != null) {
    logDiagnosticTimeline('ringback.fallback.stop', {}, {
      ringbackSource: 'web-audio-fallback',
      frequencyHz: 440,
    });
  }
  if (webAudioTimer != null) {
    window.clearInterval(webAudioTimer);
    webAudioTimer = null;
  }
  if (webAudioOscillator) {
    try {
      webAudioOscillator.stop();
    } catch {
      /* already stopped */
    }
    webAudioOscillator.disconnect();
    webAudioOscillator = null;
  }
  if (webAudioGain) {
    webAudioGain.disconnect();
    webAudioGain = null;
  }
}

function startWebAudioTone(frequencyHz: number) {
  stopWebAudioTone();
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  webAudioContext ??= new AudioCtx();
  if (webAudioContext.state === 'suspended') {
    void webAudioContext.resume();
  }

  webAudioOscillator = webAudioContext.createOscillator();
  webAudioGain = webAudioContext.createGain();
  webAudioOscillator.type = 'sine';
  webAudioOscillator.frequency.value = frequencyHz;
  webAudioGain.gain.value = 0.08;
  webAudioOscillator.connect(webAudioGain);
  webAudioGain.connect(webAudioContext.destination);
  webAudioOscillator.start();
  activeLocalToneSource = 'web-audio-fallback';
  logDiagnosticTimeline('ringback.fallback', {}, {
    ringbackSource: 'web-audio-fallback',
    frequencyHz,
    reason: 'mp3-unavailable-or-autoplay-blocked',
  });

  let on = true;
  webAudioTimer = window.setInterval(() => {
    if (!webAudioGain || !webAudioContext) return;
    on = !on;
    webAudioGain.gain.value = on ? 0.08 : 0;
  }, 500);
}

async function playLoopingSound(
  getAudio: () => HTMLAudioElement | null,
  setAudio: (audio: HTMLAudioElement | null) => void,
  src: string,
  fallbackFrequencyHz: number,
  label: string,
) {
  logDiagnosticTimeline('ringback.play', {}, {
    label,
    src,
    priorSource: activeLocalToneSource,
  });
  stopWebAudioTone();

  let audio = getAudio();
  if (!audio) {
    audio = getOrCreateLoopAudio(src);
    setAudio(audio);
  }

  audio.currentTime = 0;
  try {
    await audio.play();
    activeLocalToneSource = 'mp3';
    logDiagnosticTimeline('ringback.start', {}, {
      ringbackSource: 'mp3',
      label,
      src: audio.src,
    });
    logDiagnosticTimeline('ringback.mp3.loaded', {}, {
      label,
      src: audio.src,
    });
    return;
  } catch (err) {
    logDiagnosticTimeline('ringback.mp3.failed', {}, {
      label,
      src,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  startWebAudioTone(fallbackFrequencyHz);
}

function stopLoopingSound(getAudio: () => HTMLAudioElement | null, label: string) {
  const audio = getAudio();
  if (audio && !audio.paused) {
    logDiagnosticTimeline('ringback.pause', {}, {
      ringbackSource: 'mp3',
      label,
      src: audio.src,
    });
  }
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopWebAudioTone();
  if (activeLocalToneSource !== 'none') {
    logDiagnosticTimeline('ringback.stop', {}, {
      ringbackSource: activeLocalToneSource,
      label,
    });
    activeLocalToneSource = 'none';
  }
}

/** Prime autoplay during dial — bounded wait so outbound setup is not blocked. */
export async function primeCallAudioForDial(
  remoteAudioEl: HTMLAudioElement | null,
  timeoutMs = 750,
): Promise<boolean> {
  let settled = false;
  const result = await Promise.race([
    primeCallAudio(remoteAudioEl).then((ok) => {
      settled = true;
      return ok;
    }),
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(settled), timeoutMs);
    }),
  ]);
  return result;
}

/** Unlock browser autoplay after a user gesture (Call, Answer, dial pad). */
export async function primeCallAudio(remoteAudioEl: HTMLAudioElement | null): Promise<boolean> {
  stopWebAudioTone();

  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioCtx) {
    webAudioContext ??= new AudioCtx();
    if (webAudioContext.state === 'suspended') {
      await webAudioContext.resume().catch(() => {});
    }
  }

  if (remoteAudioEl) {
    remoteAudioEl.muted = true;
    try {
      await remoteAudioEl.play();
      remoteAudioEl.pause();
      remoteAudioEl.muted = false;
      remoteAudioEl.currentTime = 0;
      return true;
    } catch {
      remoteAudioEl.muted = false;
    }
  }

  const probe = new Audio(RINGBACK_SRC);
  probe.volume = 0.001;
  try {
    await probe.play();
    probe.pause();
    probe.currentTime = 0;
    return true;
  } catch {
    return false;
  }
}

export async function startLocalRingback() {
  await playLoopingSound(
    () => ringbackAudio,
    (audio) => { ringbackAudio = audio; },
    RINGBACK_SRC,
    440,
    'outbound-ringback',
  );
}

export function stopLocalRingback() {
  stopLoopingSound(() => ringbackAudio, 'outbound-ringback');
}

export async function startIncomingRingtone() {
  await playLoopingSound(
    () => incomingRingAudio,
    (audio) => { incomingRingAudio = audio; },
    INCOMING_RING_SRC,
    520,
    'incoming-ring',
  );
}

export function stopIncomingRingtone() {
  stopLoopingSound(() => incomingRingAudio, 'incoming-ring');
}

export function stopAllCallSounds() {
  logDiagnosticTimeline('ringback.cleanup', {}, { ringbackSource: activeLocalToneSource });
  stopLocalRingback();
  stopIncomingRingtone();
}

export async function playOutboundRingback(call: { playRingback?: () => void; stopRingback?: () => void }) {
  try {
    call.playRingback?.();
    logDiagnosticTimeline('ringback.sdk.playRingback', {}, { ringbackSource: 'telnyx-sdk' });
  } catch (err) {
    logDiagnosticTimeline('ringback.sdk.playRingback.failed', {}, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  await startLocalRingback();
}
