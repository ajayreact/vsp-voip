import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  getAudioRouteLabel,
  normalizeAudioRoute,
  resolveAudioRouteFromSpeaker,
  type AudioRouteKind,
} from '../calling/callDisplay';
import { isSpeakerForced } from '../calling/audioRoute';
import { useCallingStore } from '../store/callingStore';

type InCallManagerModule = {
  addListener?: (event: string, handler: (payload: { availableAudioDeviceList?: string[]; selectedAudioDevice?: string }) => void) => void;
  removeListener?: (event: string, handler: (payload: unknown) => void) => void;
};

function readNativeRoute(): AudioRouteKind | null {
  if (isSpeakerForced()) return 'speaker';
  return null;
}

function routesFromDeviceList(list: string[]): AudioRouteKind[] {
  const routes = new Set<AudioRouteKind>(['phone', 'speaker']);
  for (const item of list) {
    routes.add(normalizeAudioRoute(item));
  }
  return [...routes];
}

function syncSpeakerFromRoute(route: AudioRouteKind) {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  const speakerOn = route === 'speaker';
  if (active.speakerOn === speakerOn) return;
  useCallingStore.getState().patchActiveCall({ speakerOn });
}

export function useAudioRoute(speakerOn: boolean) {
  const [route, setRoute] = useState<AudioRouteKind>(() =>
    readNativeRoute() ?? resolveAudioRouteFromSpeaker(speakerOn),
  );
  const [detectedRoutes, setDetectedRoutes] = useState<AudioRouteKind[]>(['phone', 'speaker']);

  useEffect(() => {
    setRoute((current: AudioRouteKind) => {
      if (speakerOn) return 'speaker';
      if (current === 'speaker') return 'phone';
      return current;
    });
  }, [speakerOn]);

  useEffect(() => {
    const module = NativeModules.InCallManager as InCallManagerModule | undefined;
    if (!module?.addListener) return undefined;

    const emitter = new NativeEventEmitter(NativeModules.InCallManager);
    const handler = (payload: { selectedAudioDevice?: string; availableAudioDeviceList?: string[] }) => {
      const list = payload.availableAudioDeviceList ?? [];
      if (list.length) {
        setDetectedRoutes(routesFromDeviceList(list));
      }

      if (speakerOn) {
        setRoute('speaker');
        return;
      }
      if (payload.selectedAudioDevice) {
        const nextRoute = normalizeAudioRoute(payload.selectedAudioDevice);
        setRoute(nextRoute);
        syncSpeakerFromRoute(nextRoute);
        return;
      }
      const preferred =
        list.find((item) => item.toLowerCase().includes('bluetooth'))
        || list.find((item) => item.toLowerCase().includes('headset'))
        || list.find((item) => item.toLowerCase().includes('phone'));
      if (preferred) {
        const nextRoute = normalizeAudioRoute(preferred);
        setRoute(nextRoute);
        syncSpeakerFromRoute(nextRoute);
      }
    };

    const eventName = Platform.OS === 'ios' ? 'WiredHeadset' : 'onAudioDeviceChanged';
    emitter.addListener(eventName, handler);

    return () => {
      emitter.removeAllListeners(eventName);
    };
  }, [speakerOn]);

  return {
    route,
    label: getAudioRouteLabel(route),
    detectedRoutes,
  };
}
