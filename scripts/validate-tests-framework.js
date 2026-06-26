#!/usr/bin/env node
/**
 * Validates QA test framework structure and regression completeness.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TELEPHONY = [
  'inbound-call.test.ts',
  'outbound-call.test.ts',
  'two-way-audio.test.ts',
  'blind-transfer.test.ts',
  'voicemail.test.ts',
  'recording.test.ts',
  'call-history.test.ts',
  'notifications.test.ts',
  'tenant-routing.test.ts',
  'did-management.test.ts',
  'extension-routing.test.ts',
  'conference.test.ts',
  'warm-transfer.test.ts',
  'ivr.test.ts',
  'queue.test.ts',
];

const REGRESSION_ITEMS = [
  'registration',
  'inbound',
  'outbound',
  'two-way audio',
  'recording',
  'voicemail',
  'blind transfer',
  'did routing',
  'tenant isolation',
  'extension routing',
];

const K6 = ['k6-100-users.js', 'k6-500-users.js', 'k6-1000-users.js', 'k6-5000-users.js'];

let failed = 0;
function pass(m) { console.log(`  ✓ ${m}`); }
function fail(m) { console.error(`  ✗ ${m}`); failed++; }

console.log('QA framework validation\n');

console.log('Telephony tests:');
for (const f of TELEPHONY) {
  fs.existsSync(path.join(ROOT, 'tests/telephony', f)) ? pass(f) : fail(`missing ${f}`);
}

console.log('\nAPI tests:');
['authentication.test.ts', 'softphone-api.test.ts', 'did-api.test.ts', 'transfer-recording-voicemail.test.ts'].forEach((f) => {
  fs.existsSync(path.join(ROOT, 'tests/api', f)) ? pass(f) : fail(`missing api/${f}`);
});

console.log('\nBrowser tests:');
fs.existsSync(path.join(ROOT, 'tests/browser/softphone.spec.ts')) ? pass('softphone.spec.ts') : fail('missing browser spec');

console.log('\nRegression suite:');
const reg = fs.readFileSync(path.join(ROOT, 'tests/regression/deploy-regression.test.ts'), 'utf8').toLowerCase();
for (const item of REGRESSION_ITEMS) {
  reg.includes(item) ? pass(`regression: ${item}`) : fail(`regression missing ${item}`);
}

console.log('\nPerformance (k6):');
for (const f of K6) {
  fs.existsSync(path.join(ROOT, 'tests/performance', f)) ? pass(f) : fail(`missing ${f}`);
}

console.log('\nReporting:');
fs.existsSync(path.join(ROOT, 'tests/lib/report-html.js')) ? pass('report-html.js') : fail('missing report-html.js');
fs.existsSync(path.join(ROOT, 'reports/.gitkeep')) ? pass('reports/') : fail('missing reports/');

console.log('\nOrchestration:');
fs.existsSync(path.join(ROOT, 'scripts/run-qa-suite.js')) ? pass('run-qa-suite.js') : fail('missing run-qa-suite.js');
fs.existsSync(path.join(ROOT, 'vitest.config.ts')) ? pass('vitest.config.ts') : fail('missing vitest.config.ts');
fs.existsSync(path.join(ROOT, '.cursor/rules/qa-first.mdc')) ? pass('qa-first.mdc') : fail('missing qa-first.mdc');

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
