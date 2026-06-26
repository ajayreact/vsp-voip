#!/usr/bin/env node
/**
 * Validates VSP PBX documentation exists, Mermaid blocks present, ADRs, features, and Cursor rule.
 * Usage: node scripts/validate-pbx-docs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PBX_DIR = path.join(ROOT, 'docs', 'vsp', 'pbx');
const ADR_DIR = path.join(ROOT, 'docs', 'vsp', 'architecture-decisions');

const PBX_DOCS = [
  '01-system-architecture.md',
  '02-call-flow.md',
  '03-websocket-lifecycle.md',
  '04-webrtc-media.md',
  '05-call-control.md',
  '06-session-management.md',
  '07-multitenancy.md',
  '08-did-routing.md',
  '09-extension-routing.md',
  '10-ring-groups.md',
  '11-call-queues.md',
  '12-ivr.md',
  '13-call-recording.md',
  '14-voicemail.md',
  '15-blind-transfer.md',
  '16-attended-transfer.md',
  '17-conference-calls.md',
  '18-presence.md',
  '19-mobile-app.md',
  '20-api-reference.md',
  '21-event-sequence.md',
  '22-security.md',
  '23-performance.md',
  '24-future-roadmap.md',
  'README.md',
  'VALIDATION.md',
];

const ADRS = [
  'bridge-grace.md',
  'call-control.md',
  'redis.md',
  'tenant-scoped-extensions.md',
  'did-assignment.md',
  'webrtc.md',
  'recordings.md',
  'voicemail.md',
  'diagnostics.md',
  'deployment.md',
  'README.md',
];

const MERMAID_FILES = [
  '01-system-architecture.md',
  '02-call-flow.md',
  '03-websocket-lifecycle.md',
  '04-webrtc-media.md',
  '05-call-control.md',
  '06-session-management.md',
  '07-multitenancy.md',
  '08-did-routing.md',
  '15-blind-transfer.md',
  '16-attended-transfer.md',
];

const FEATURE_KEYWORDS = [
  'softphone',
  'inbound',
  'outbound',
  'voicemail',
  'recording',
  'blind transfer',
  'warm transfer',
  'conference',
  'queues',
  'ring groups',
  'ivr',
  'business hours',
  'call parking',
  'presence',
  'crm',
  'flutter mobile',
  'desktop app',
  'sms',
  'fax',
  'ai call summary',
  'transcription',
];

const ADR_SECTIONS = ['## Problem', '## Decision', '## Reason', '## Alternatives', '## Trade-offs', '## Future impact'];

const PBX_RULE = '.cursor/rules/pbx-architecture.mdc';
const RULE_PHRASES = [
  'Never introduce duplicate call flows',
  'Never duplicate session management',
  'Never bypass tenant isolation',
  'Never bypass Call Control',
  'Never bypass Redis session management',
];

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

function read(relDir, name) {
  return fs.readFileSync(path.join(relDir, name), 'utf8');
}

console.log('VSP PBX docs validation\n');

console.log('PBX documents:');
for (const name of PBX_DOCS) {
  fs.existsSync(path.join(PBX_DIR, name)) ? pass(name) : fail(`missing ${name}`);
}

console.log('\nArchitecture decisions:');
for (const name of ADRS) {
  fs.existsSync(path.join(ADR_DIR, name)) ? pass(name) : fail(`missing ADR ${name}`);
}

console.log('\nMermaid diagrams:');
for (const name of MERMAID_FILES) {
  const content = read(PBX_DIR, name);
  if (content.includes('```mermaid')) pass(`${name} has mermaid`);
  else fail(`${name} missing mermaid block`);
}

console.log('\nFeature matrix:');
const featuresPath = path.join(ROOT, 'docs', 'vsp', 'features.md');
if (!fs.existsSync(featuresPath)) {
  fail('missing docs/vsp/features.md');
} else {
  pass('features.md exists');
  const features = fs.readFileSync(featuresPath, 'utf8').toLowerCase();
  for (const kw of FEATURE_KEYWORDS) {
    features.includes(kw) ? pass(`features mentions "${kw}"`) : fail(`features missing "${kw}"`);
  }
}

console.log('\nADR structure (sample):');
for (const name of ['bridge-grace.md', 'call-control.md', 'redis.md']) {
  const content = read(ADR_DIR, name);
  for (const section of ADR_SECTIONS) {
    content.includes(section) ? pass(`${name} ${section}`) : fail(`${name} missing ${section}`);
  }
}

console.log('\nCursor rule:');
const rulePath = path.join(ROOT, PBX_RULE);
if (!fs.existsSync(rulePath)) {
  fail(`missing ${PBX_RULE}`);
} else {
  pass(PBX_RULE);
  const rule = fs.readFileSync(rulePath, 'utf8');
  for (const phrase of RULE_PHRASES) {
    rule.includes(phrase) ? pass(`rule: "${phrase}"`) : fail(`rule missing "${phrase}"`);
  }
}

console.log('\nInternal links (README):');
const readme = read(PBX_DIR, 'README.md');
const links = readme.match(/\(\.\/[0-9]{2}-[^)]+\.md\)/g) || [];
if (links.length >= 20) pass(`README links ${links.length} pbx docs`);
else fail(`README has only ${links.length} doc links`);

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
