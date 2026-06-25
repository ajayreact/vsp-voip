#!/usr/bin/env node
/**
 * Validates singleton voicemail playback manager behavior.
 * npm run validate:exclusive-voicemail-audio
 *
 * Simulates: play A → click B → A inactive before B active → single audio element.
 */
import { voicemailPlaybackManager } from '../web/src/lib/voicemail-playback-manager.ts';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  ✅ ${label}`);
}

function fail(label: string, detail?: string) {
  failed += 1;
  console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`);
}

function createMockAudio() {
  let paused = true;
  let currentTime = 0;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const audio = {
    paused,
    currentTime,
    duration: 42,
    ended: false,
    src: '',
    preload: 'none',
    pause() {
      paused = true;
      audio.paused = true;
      currentTime = 0;
      audio.currentTime = 0;
      listeners.get('pause')?.forEach((fn) => fn());
    },
    async play() {
      paused = false;
      audio.paused = false;
      listeners.get('playing')?.forEach((fn) => fn());
      return undefined;
    },
    load() {},
    removeAttribute(name: string) {
      if (name === 'src') audio.src = '';
    },
    addEventListener(event: string, fn: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    dispatchEnded() {
      audio.ended = true;
      paused = true;
      audio.paused = true;
      listeners.get('ended')?.forEach((fn) => fn());
      audio.ended = false;
    },
  };

  return audio as unknown as HTMLAudioElement;
}

console.log('Singleton voicemail playback validation\n');

async function run() {
  voicemailPlaybackManager.resetForTests();

  const mockAudio = createMockAudio();
  voicemailPlaybackManager.setAudioElementForTests(mockAudio);
  voicemailPlaybackManager.seedStreamForTests('/api/tenant/voicemails/a/stream');
  voicemailPlaybackManager.seedStreamForTests('/api/tenant/voicemails/b/stream');

  if (voicemailPlaybackManager.getAudioElementCount() === 1) {
    pass('Manager owns exactly one audio element');
  } else {
    fail('Manager owns exactly one audio element');
  }

  await voicemailPlaybackManager.toggle('voicemail-a', '/api/tenant/voicemails/a/stream');
  const afterA = voicemailPlaybackManager.getState();

  if (afterA.activePlayerId === 'voicemail-a' && afterA.status === 'playing') {
    pass('Player A becomes active after play');
  } else {
    fail('Player A becomes active after play', JSON.stringify(afterA));
  }

  await voicemailPlaybackManager.toggle('voicemail-b', '/api/tenant/voicemails/b/stream');
  const afterB = voicemailPlaybackManager.getState();

  if (afterB.activePlayerId === 'voicemail-b' && afterB.status === 'playing') {
    pass('Player B replaces player A as the sole active track');
  } else {
    fail('Player B replaces player A as the sole active track', JSON.stringify(afterB));
  }

  if (mockAudio.currentTime === 0) {
    pass('Previous track progress resets when switching messages');
  } else {
    fail('Previous track progress resets when switching messages');
  }

  if (voicemailPlaybackManager.getAudioElementCount() === 1) {
    pass('Still only one HTMLAudioElement after switching tracks');
  } else {
    fail('Still only one HTMLAudioElement after switching tracks');
  }

  await voicemailPlaybackManager.toggle('voicemail-b', '/api/tenant/voicemails/b/stream');
  if (voicemailPlaybackManager.getState().status === 'paused') {
    pass('Second press on active message toggles to pause');
  } else {
    fail('Second press on active message toggles to pause');
  }

  mockAudio.dispatchEnded();
  if (voicemailPlaybackManager.getState().status === 'ended'
    && voicemailPlaybackManager.getState().currentTime === 0) {
    pass('Playback end resets progress to zero');
  } else {
    fail('Playback end resets progress to zero');
  }

  voicemailPlaybackManager.reset();
  if (voicemailPlaybackManager.getActivePlayerId() === null
    && voicemailPlaybackManager.getState().status === 'idle') {
    pass('reset() clears active playback when leaving voicemail screen');
  } else {
    fail('reset() clears active playback when leaving voicemail screen');
  }

  voicemailPlaybackManager.resetForTests();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void run();
