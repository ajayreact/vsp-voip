import InCallManager from 'react-native-incall-manager';

let active = false;
let speakerForced = false;

export function startCallAudio(speakerOn = false) {
  if (!active) {
    InCallManager.start({ media: 'audio' });
    active = true;
  }
  setSpeakerEnabled(speakerOn);
}

export function stopCallAudio() {
  if (!active) return;
  InCallManager.setForceSpeakerphoneOn(false);
  InCallManager.stop();
  active = false;
  speakerForced = false;
}

/** Earpiece by default; speaker when forced. Bluetooth routes when speaker is off. */
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
  if (!active) return;
  setSpeakerEnabled(speakerOn);
}
