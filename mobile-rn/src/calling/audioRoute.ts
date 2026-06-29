import InCallManager from 'react-native-incall-manager';
import type { AudioRouteKind } from './callDisplay';

let active = false;
let speakerForced = false;

export function startCallAudio(speakerOn = false) {
  if (!active) {
    InCallManager.start({ media: 'audio' });
    InCallManager.setKeepScreenOn(true);
    active = true;
  }
  setSpeakerEnabled(speakerOn);
}

export function stopCallAudio() {
  if (!active) return;
  InCallManager.setForceSpeakerphoneOn(false);
  InCallManager.setKeepScreenOn(false);
  InCallManager.stop();
  active = false;
  speakerForced = false;
}

/** Speaker when forced; earpiece/Bluetooth/wired when speaker is off. */
export function setSpeakerEnabled(enabled: boolean) {
  speakerForced = enabled;
  InCallManager.setForceSpeakerphoneOn(enabled);
  if (!enabled) {
    InCallManager.setSpeakerphoneOn(false);
  }
}

export function isSpeakerForced() {
  return speakerForced;
}

export function syncCallAudioRoute(speakerOn: boolean) {
  if (!active) {
    startCallAudio(speakerOn);
    return;
  }
  setSpeakerEnabled(speakerOn);
}

export function isCallAudioActive() {
  return active;
}

type InCallRouteModule = {
  chooseAudioRoute?: (route: string) => void;
};

const ROUTE_NATIVE: Partial<Record<AudioRouteKind, string>> = {
  phone: 'EARPIECE',
  speaker: 'SPEAKER_PHONE',
  bluetooth: 'BLUETOOTH',
  wired: 'WIRED_HEADSET',
};

export function selectCallAudioRoute(route: AudioRouteKind): boolean {
  if (route === 'speaker') {
    setSpeakerEnabled(true);
    return true;
  }

  setSpeakerEnabled(false);
  const nativeRoute = ROUTE_NATIVE[route];
  const module = InCallManager as InCallRouteModule;
  if (nativeRoute && module.chooseAudioRoute) {
    module.chooseAudioRoute(nativeRoute);
    return true;
  }

  return route === 'phone';
}
