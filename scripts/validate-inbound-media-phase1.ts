/**
 * Phase 1 inbound media fix — static + unit checks (no live Telnyx call).
 * npm run validate:inbound-media-phase1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function pass(msg: string) {
  passed += 1;
  console.log(`✅ ${msg}`);
}

function fail(msg: string, detail?: string) {
  failed += 1;
  console.log(`❌ ${msg}${detail ? ` — ${detail}` : ''}`);
}

const page = read('web/src/app/(app)/softphone-v2/page.tsx');
const webrtc = read('web/src/lib/webrtc-audio.ts');

if (page.includes('acquireMicrophoneStream') && page.includes('getUserMedia({ audio: true })')) {
  pass('softphone-v2 acquires microphone via getUserMedia');
} else {
  fail('softphone-v2 microphone acquisition');
}

if (page.includes('options.localStream = localStream')) {
  pass('softphone-v2 passes localStream into Telnyx call options');
} else {
  fail('softphone-v2 localStream assignment');
}

if (page.includes('void postCallAccepted()') && !page.includes('await postCallAccepted()')) {
  pass('postCallAccepted is fire-and-forget (not awaited)');
} else {
  fail('postCallAccepted should not be awaited');
}

const onAnswerStart = page.indexOf('const onAnswer = async () => {');
const onAnswerEnd = page.indexOf('const onDeclineIncoming', onAnswerStart);
const onAnswerBlock = page.slice(onAnswerStart, onAnswerEnd);

if (onAnswerBlock.includes('await call.answer()') && onAnswerBlock.indexOf('await call.answer()') < onAnswerBlock.indexOf('attachCallMedia')) {
  pass('call.answer() runs before attachCallMedia in onAnswer');
} else {
  fail('call.answer() ordering in onAnswer');
}

if (!page.includes('track.stop()') || !page.includes('ensureMicrophoneAccess')) {
  pass('removed probe-and-discard ensureMicrophoneAccess pattern');
} else if (page.includes('ensureMicrophoneAccess')) {
  fail('ensureMicrophoneAccess probe-and-discard still present');
} else {
  pass('no track.stop() in answer path');
}

if (webrtc.includes('enableSenderTracks') && webrtc.includes('verifyLocalAudioSenders')) {
  pass('webrtc-audio enables and verifies sender tracks');
} else {
  fail('webrtc-audio sender track helpers');
}

if (webrtc.includes('verifyLocalAudioSenders(call, pc')) {
  pass('wireWebCallAudio refresh verifies local senders');
} else {
  fail('wireWebCallAudio sender verification');
}

// Outbound media — align with Telnyx ICallOptions (audio, localStream, remoteElement)
const outboundIdx = page.indexOf('const onCallWithDestination = async');
const outboundEnd = page.indexOf('const onAnswer = async', outboundIdx);
const outboundBlock = page.slice(outboundIdx, outboundEnd);

if (outboundBlock.includes('await acquireMicrophoneStream()')) {
  pass('outbound acquires microphone before newCall');
} else {
  fail('outbound microphone acquisition before newCall');
}

if (outboundBlock.includes('audio: true') && outboundBlock.includes('localStream')) {
  pass('outbound newCall passes audio:true and localStream');
} else {
  fail('outbound newCall media options');
}

if (outboundBlock.includes('remoteElement:')) {
  pass('outbound newCall passes remoteElement');
} else {
  fail('outbound newCall remoteElement');
}

const gumIdx = outboundBlock.indexOf('await acquireMicrophoneStream()');
const newCallIdx = outboundBlock.indexOf('client.newCall({');
if (gumIdx !== -1 && newCallIdx !== -1 && gumIdx < newCallIdx) {
  pass('localStream acquired before newCall');
} else {
  fail('localStream ordering before newCall');
}

if (!outboundBlock.includes('postCallAccepted')) {
  pass('outbound newCall path does not call postCallAccepted');
} else {
  fail('postCallAccepted must not be in outbound path');
}

// Mock verifyLocalAudioSenders behavior
async function testVerifyLocalAudioSenders() {
  const { verifyLocalAudioSenders } = await import('../web/src/lib/webrtc-audio.ts');

  const audioTrack = {
    kind: 'audio',
    enabled: false,
    readyState: 'live',
    muted: false,
  } as MediaStreamTrack;

  const stream = {
    getAudioTracks: () => [audioTrack],
  } as unknown as MediaStream;

  const sender = { track: audioTrack };
  const pc = {
    getSenders: () => [sender],
    getReceivers: () => [],
  } as unknown as RTCPeerConnection;

  const call = {
    localStream: stream,
    peer: { peerConnection: pc },
    isAudioMuted: false,
  } as unknown as import('@telnyx/webrtc').Call;

  const status = verifyLocalAudioSenders(call, pc);
  if (status.senderCount === 1 && status.liveEnabledCount === 1 && audioTrack.enabled) {
    pass('verifyLocalAudioSenders enables disabled audio sender track');
  } else {
    fail('verifyLocalAudioSenders unit behavior', JSON.stringify(status));
  }
}

async function main() {
  await testVerifyLocalAudioSenders();
  console.log(`\n=== Phase 1 inbound media validation ===\nPassed: ${passed}  Failed: ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
