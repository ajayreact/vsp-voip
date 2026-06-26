#!/usr/bin/env node
/**
 * Validates VSP deployment documentation exists and cross-links resolve.
 * Usage: node scripts/validate-deployment-docs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEPLOY_DIR = path.join(ROOT, 'docs', 'vsp', 'deployment');

const REQUIRED_DOCS = [
  '01-local-development.md',
  '02-ec2-deployment.md',
  '03-docker.md',
  '04-pm2.md',
  '05-nginx.md',
  '06-database-migrations.md',
  '07-prisma.md',
  '08-rollback.md',
  '09-release-process.md',
  '10-production-checklist.md',
  '11-known-issues.md',
  '12-disaster-recovery.md',
  '13-monitoring.md',
  '14-telephony-validation.md',
  'VALIDATION.md',
];

const REQUIRED_SCRIPTS = [
  'deploy/deploy-api.sh',
  'deploy/deploy-web.sh',
  'deploy/pm2.ecosystem.config.js',
  'deploy/nginx/vspphone.conf',
];

const REQUIRED_RULE = '.cursor/rules/deployment-safety.mdc';

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

console.log('VSP deployment docs validation\n');

console.log('Documents:');
for (const name of REQUIRED_DOCS) {
  const full = path.join(DEPLOY_DIR, name);
  if (fs.existsSync(full)) {
    pass(name);
  } else {
    fail(`missing ${name}`);
  }
}

console.log('\nReferenced deploy assets:');
for (const rel of REQUIRED_SCRIPTS) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    pass(rel);
  } else {
    fail(`missing ${rel}`);
  }
}

console.log('\nCursor rule:');
if (fs.existsSync(path.join(ROOT, REQUIRED_RULE))) {
  pass(REQUIRED_RULE);
} else {
  fail(`missing ${REQUIRED_RULE}`);
}

console.log('\nInternal links (sample):');
const ec2 = fs.readFileSync(path.join(DEPLOY_DIR, '02-ec2-deployment.md'), 'utf8');
const linkPattern = /\]\(\.\/([a-z0-9-]+\.md)\)/gi;
const linked = new Set();
let m;
while ((m = linkPattern.exec(ec2)) !== null) {
  linked.add(m[1]);
}
for (const target of linked) {
  if (fs.existsSync(path.join(DEPLOY_DIR, target))) {
    pass(`02-ec2-deployment.md → ${target}`);
  } else {
    fail(`broken link in 02-ec2-deployment.md → ${target}`);
  }
}

console.log('\nProduction checklist keywords:');
const checklist = fs.readFileSync(path.join(DEPLOY_DIR, '10-production-checklist.md'), 'utf8').toLowerCase();
const keywords = [
  'git status',
  'correct branch',
  'correct commit',
  'docker',
  'prisma migration',
  'api healthy',
  'frontend healthy',
  'websocket',
  'telnyx login',
  'microphone',
  'inbound',
  'outbound',
  'voicemail',
  'recording',
  'transfer',
  'did sync',
  'assignment',
  'extension',
];
for (const kw of keywords) {
  if (checklist.includes(kw)) {
    pass(`checklist mentions "${kw}"`);
  } else {
    fail(`checklist missing "${kw}"`);
  }
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
