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

const K6 = ['k6-100-users.js', 'k6-500-users.js', 'k6-1000-users.js', 'k6-5000-users.js', 'k6-messaging.js', 'k6-messaging-smoke.js'];

let failed = 0;
function pass(m) { console.log(`  ✓ ${m}`); }
function fail(m) { console.error(`  ✗ ${m}`); failed++; }

console.log('QA framework validation\n');

console.log('Telephony tests:');
for (const f of TELEPHONY) {
  fs.existsSync(path.join(ROOT, 'tests/telephony', f)) ? pass(f) : fail(`missing ${f}`);
}

console.log('\nAPI tests:');
[
  'authentication.test.ts',
  'auth-lifecycle.test.ts',
  'softphone-api.test.ts',
  'did-api.test.ts',
  'messaging-api.test.ts',
  'transfer-recording-voicemail.test.ts',
  'rest-coverage.test.ts',
].forEach((f) => {
  fs.existsSync(path.join(ROOT, 'tests/api', f)) ? pass(f) : fail(`missing api/${f}`);
});

console.log('\nBrowser tests:');
[
  'softphone.spec.ts',
  'portal-auth.spec.ts',
  'portal-navigation.spec.ts',
].forEach((f) => {
  fs.existsSync(path.join(ROOT, 'tests/browser', f)) ? pass(f) : fail(`missing browser/${f}`);
});
fs.existsSync(path.join(ROOT, 'tests/browser/helpers/auth.ts')) ? pass('helpers/auth.ts') : fail('missing browser helper');

console.log('\nMobile component tests:');
[
  'components/error-boundary.test.ts',
  'components/messaging-states.test.ts',
  'components/vsp-badge.test.ts',
  'components/search-bar.test.ts',
].forEach((f) => {
  fs.existsSync(path.join(ROOT, 'tests/mobile', f)) ? pass(f) : fail(`missing mobile/${f}`);
});

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
fs.existsSync(path.join(ROOT, 'scripts/smoke-deploy.js')) ? pass('smoke-deploy.js') : fail('missing smoke-deploy.js');
fs.existsSync(path.join(ROOT, 'scripts/run-release-checklist.js')) ? pass('run-release-checklist.js') : fail('missing run-release-checklist.js');
fs.existsSync(path.join(ROOT, 'vitest.config.ts')) ? pass('vitest.config.ts') : fail('missing vitest.config.ts');
fs.existsSync(path.join(ROOT, '.github/workflows/qa-automation.yml')) ? pass('qa-automation.yml') : fail('missing qa-automation.yml');
fs.existsSync(path.join(ROOT, 'docs/qa/release-checklist.md')) ? pass('release-checklist.md') : fail('missing release-checklist.md');
fs.existsSync(path.join(ROOT, 'docs/qa/production-monitoring.md')) ? pass('production-monitoring.md') : fail('missing production-monitoring.md');
fs.existsSync(path.join(ROOT, 'tests/lib/endpoints.ts')) ? pass('endpoints.ts registry') : fail('missing endpoints registry');
fs.existsSync(path.join(ROOT, '.cursor/rules/qa-first.mdc')) ? pass('qa-first.mdc') : fail('missing qa-first.mdc');

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
