const RINGBACK_SRC = '/sounds/ringback.mp3';
const INCOMING_RING_SRC = '/sounds/incoming-ring.mp3';

let ringbackAudio: HTMLAudioElement | null = null;
let incomingRingAudio: HTMLAudioElement | null = null;
let webAudioContext: AudioContext | null = null;
let webAudioOscillator: OscillatorNode | null = null;
let webAudioGain: GainNode | null = null;
let webAudioTimer: number | null = null;

function getOrCreateLoopAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  return audio;
}

function stopWebAudioTone() {
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
) {
  stopWebAudioTone();

  let audio = getAudio();
  if (!audio) {
    audio = getOrCreateLoopAudio(src);
    setAudio(audio);
  }

  audio.currentTime = 0;
  try {
    await audio.play();
    return;
  } catch {
    /* fall through to Web Audio fallback */
  }

  startWebAudioTone(fallbackFrequencyHz);
}

function stopLoopingSound(getAudio: () => HTMLAudioElement | null) {
  const audio = getAudio();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopWebAudioTone();
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
  );
}

export function stopLocalRingback() {
  stopLoopingSound(() => ringbackAudio);
}

export async function startIncomingRingtone() {
  await playLoopingSound(
    () => incomingRingAudio,
    (audio) => { incomingRingAudio = audio; },
    INCOMING_RING_SRC,
    520,
  );
}

export function stopIncomingRingtone() {
  stopLoopingSound(() => incomingRingAudio);
}

export function stopAllCallSounds() {
  stopLocalRingback();
  stopIncomingRingtone();
}

export async function playOutboundRingback(call: { playRingback?: () => void; stopRingback?: () => void }) {
  try {
    call.playRingback?.();
  } catch (err) {
    console.warn('Telnyx ringback unavailable:', err);
  }
  // Always play local ringback — Telnyx playRingback is a no-op when there is no
  // carrier early-media ringback (e.g. desk SIP, internal extension bridge legs).
  await startLocalRingback();
}
