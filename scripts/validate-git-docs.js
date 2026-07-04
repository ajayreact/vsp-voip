#!/usr/bin/env node
/**
 * Validates VSP Git workflow documentation.
 * Usage: node scripts/validate-git-docs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GIT_DIR = path.join(ROOT, 'docs', 'vsp', 'git');

const DOCS = [
  'README.md',
  '01-branch-strategy.md',
  '02-git-rules.md',
  '03-release-workflow.md',
  '04-tagging.md',
  '05-merge-checklist.md',
  '06-release-checklist.md',
  '07-rollback-strategy.md',
  'VALIDATION.md',
];

const MERGE_ITEMS = [
  'inbound calls',
  'outbound calls',
  'two-way audio',
  'recording',
  'voicemail',
  'blind transfer',
  'did assignment',
  'extension routing',
  'tenant isolation',
  'validation scripts',
];

const RELEASE_ITEMS = [
  'git tag',
  'docker image',
  'prisma migration',
  'api health',
  'frontend health',
  'pm2',
  'nginx',
  'webrtc',
  'ice',
  'turn',
  'recording',
  'voicemail',
  'transfer',
  'browser cache',
  'deployment validation',
];

const BRANCHES = ['main', 'development', 'feature/*', 'hotfix/*', 'release/*'];

const RULE = '.cursor/rules/git-workflow.mdc';
const RULE_PHRASES = [
  'Never modify `main` directly',
  'Always create a feature branch',
  'last stable tag',
  'validation before merging',
];

const SCRIPTS = ['scripts/git-new-feature.sh', 'scripts/git-pre-merge-check.sh'];

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

function read(name) {
  return fs.readFileSync(path.join(GIT_DIR, name), 'utf8');
}

console.log('VSP Git workflow docs validation\n');

console.log('Documents:');
for (const name of DOCS) {
  fs.existsSync(path.join(GIT_DIR, name)) ? pass(name) : fail(`missing ${name}`);
}

console.log('\nBranch strategy:');
const strategy = read('01-branch-strategy.md').toLowerCase();
for (const b of BRANCHES) {
  strategy.includes(b.replace('/*', '')) || strategy.includes(b)
    ? pass(`documents ${b}`)
    : fail(`missing branch ${b}`);
}

console.log('\nGit rules:');
const rules = read('02-git-rules.md').toLowerCase();
[
  ['never develop directly on', 'main'],
  ['never deploy from', 'feature'],
  ['production deployments only from', 'main'],
].forEach(([phrase, extra]) => {
  rules.includes(phrase) && rules.includes(extra)
    ? pass(`${phrase} + ${extra}`)
    : fail(`rules missing: ${phrase}`);
});

console.log('\nRelease workflow:');
const workflow = read('03-release-workflow.md').toLowerCase();
['feature/*', 'development', 'release/', 'main', 'production'].forEach((step) => {
  workflow.includes(step.replace('/*', '')) || workflow.includes(step)
    ? pass(`workflow includes ${step}`)
    : fail(`workflow missing ${step}`);
});

console.log('\nMerge checklist:');
const merge = read('05-merge-checklist.md').toLowerCase();
for (const item of MERGE_ITEMS) {
  merge.includes(item) ? pass(`merge: ${item}`) : fail(`merge missing ${item}`);
}

console.log('\nRelease checklist:');
const release = read('06-release-checklist.md').toLowerCase();
for (const item of RELEASE_ITEMS) {
  release.includes(item) ? pass(`release: ${item}`) : fail(`release missing ${item}`);
}

console.log('\nRollback:');
const rollback = read('07-rollback-strategy.md').toLowerCase();
[
  'previous git tag',
  'frontend only',
  'backend only',
  'docker image',
  'prisma migration',
  'rollback deployment',
].forEach((topic) => {
  rollback.includes(topic) ? pass(`rollback: ${topic}`) : fail(`rollback missing ${topic}`);
});

console.log('\nCursor rule:');
if (!fs.existsSync(path.join(ROOT, RULE))) {
  fail(`missing ${RULE}`);
} else {
  pass(RULE);
  const rule = fs.readFileSync(path.join(ROOT, RULE), 'utf8');
  for (const phrase of RULE_PHRASES) {
    rule.toLowerCase().includes(phrase.toLowerCase()) ? pass(`rule: ${phrase}`) : fail(`rule missing ${phrase}`);
  }
}

console.log('\nHelper scripts:');
for (const rel of SCRIPTS) {
  fs.existsSync(path.join(ROOT, rel)) ? pass(rel) : fail(`missing ${rel}`);
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
