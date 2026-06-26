import InCallManager from 'react-native-incall-manager';

let active = false;

export function startCallAudio() {
  if (active) return;
  InCallManager.start({ media: 'audio' });
  InCallManager.setForceSpeakerphoneOn(false);
  active = true;
}

export function stopCallAudio() {
  if (!active) return;
  InCallManager.stop();
  active = false;
}

export function setSpeakerEnabled(enabled: boolean) {
  InCallManager.setForceSpeakerphoneOn(enabled);
}
