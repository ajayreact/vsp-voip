#!/usr/bin/env node
/**
 * Validates voicemail/call-recording stream helpers against Telnyx Call Recordings API docs.
 * npm run validate:recording-stream
 *
 * @see https://developers.telnyx.com/api-reference/call-recordings/retrieve-a-call-recording
 */
const {
  pickTelnyxDownloadUrl,
  classifyRecordingNotFound,
  toRecordingStreamHttpError,
} = require('../lib/recordingSync');

let passed = 0;
let failed = 0;

function pass(label) {
  passed += 1;
  console.log(`  ✅ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('Recording stream validation\n');

const sampleRecording = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  download_urls: {
    mp3: 'https://s3.amazonaws.com/example/recording.mp3?X-Amz-Signature=abc',
    wav: 'https://s3.amazonaws.com/example/recording.wav?X-Amz-Signature=def',
  },
};

if (pickTelnyxDownloadUrl(sampleRecording) === sampleRecording.download_urls.mp3) {
  pass('pickTelnyxDownloadUrl prefers mp3 from download_urls');
} else {
  fail('pickTelnyxDownloadUrl prefers mp3 from download_urls');
}

if (classifyRecordingNotFound('uuid', { callSid: 'v3:abc' }) === 'legacy_texml') {
  pass('classifyRecordingNotFound detects TeXML call SID prefix');
} else {
  fail('classifyRecordingNotFound detects TeXML call SID prefix');
}

if (classifyRecordingNotFound('3fa85f64-5717-4562-b3fc-2c963f66afa6', { callSid: 'sess-1' })
  === 'invalid_or_deleted_call_control') {
  pass('classifyRecordingNotFound flags UUID Call Control id missing in Telnyx');
} else {
  fail('classifyRecordingNotFound flags UUID Call Control id missing in Telnyx');
}

const axiosLike = Object.assign(new Error('Request failed with status code 404'), { status: 404 });
const sanitized = toRecordingStreamHttpError(axiosLike, 'voicemail');
if (sanitized.error === 'Unable to play voicemail. Please try again.' && sanitized.status === 404) {
  pass('toRecordingStreamHttpError hides raw axios messages');
} else {
  fail('toRecordingStreamHttpError hides raw axios messages', JSON.stringify(sanitized));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
