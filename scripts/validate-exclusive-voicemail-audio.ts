#!/usr/bin/env node
/**
 * Validates exclusive voicemail audio session behavior.
 * npm run validate:exclusive-voicemail-audio
 *
 * Simulates: play A → click B → A paused before B active → only one active id.
 */
import {
  clearExclusiveAudioGroup,
  getActiveExclusivePlayerId,
  requestExclusivePlayback,
  resetExclusiveAudioSessionForTests,
} from '../web/src/lib/exclusive-audio-session.ts';

const GROUP = 'voicemail';

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

console.log('Exclusive voicemail audio validation\n');

resetExclusiveAudioSessionForTests();

let aPlaying = false;
let bPlaying = false;
let aPausedBeforeB = false;

const pauseA = () => {
  aPausedBeforeB = aPlaying;
  aPlaying = false;
};

const pauseB = () => {
  bPlaying = false;
};

requestExclusivePlayback(GROUP, 'voicemail-a', pauseA);
aPlaying = true;

if (getActiveExclusivePlayerId(GROUP) === 'voicemail-a') {
  pass('Player A becomes active after first play');
} else {
  fail('Player A becomes active after first play');
}

requestExclusivePlayback(GROUP, 'voicemail-b', pauseB);

if (aPausedBeforeB) {
  pass('Player A is paused before player B claims playback');
} else {
  fail('Player A is paused before player B claims playback');
}

if (getActiveExclusivePlayerId(GROUP) === 'voicemail-b') {
  pass('Only player B is active after switching');
} else {
  fail('Only player B is active after switching', getActiveExclusivePlayerId(GROUP) ?? 'none');
}

bPlaying = true;
requestExclusivePlayback(GROUP, 'voicemail-b', pauseB);

if (getActiveExclusivePlayerId(GROUP) === 'voicemail-b' && aPlaying === false && bPlaying === true) {
  pass('Re-claiming the same player does not stop itself');
} else {
  fail('Re-claiming the same player does not stop itself');
}

clearExclusiveAudioGroup(GROUP);

if (getActiveExclusivePlayerId(GROUP) === null && bPlaying === false) {
  pass('clearExclusiveAudioGroup stops active player and resets session');
} else {
  fail('clearExclusiveAudioGroup stops active player and resets session');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
