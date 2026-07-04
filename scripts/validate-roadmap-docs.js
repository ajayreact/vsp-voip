#!/usr/bin/env node
/**
 * Validates VSP product roadmap documentation.
 * Usage: node scripts/validate-roadmap-docs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROADMAP_DIR = path.join(ROOT, 'docs', 'vsp', 'roadmap');

const DOCS = [
  'README.md',
  '01-current-state.md',
  '02-priority-roadmap.md',
  '03-feature-dependencies.md',
  '04-release-plan.md',
  '05-testing-strategy.md',
  '06-performance-plan.md',
  '07-security-plan.md',
  '08-mobile-roadmap.md',
  '09-ai-roadmap.md',
  '10-enterprise-roadmap.md',
  'VALIDATION.md',
];

const CURRENT_STATE_ITEMS = [
  'softphone',
  'inbound',
  'outbound',
  'voicemail',
  'recording',
  'blind transfer',
  'did',
  'multi-tenant',
  'deployment',
];

const P0_ITEMS = ['two-way audio', 'production validation', 'browser compatibility', 'regression'];
const P1_ITEMS = ['warm transfer', 'conference', 'presence', 'call pickup'];
const P2_ITEMS = ['call queue', 'ring group', 'business hours', 'holiday', 'ivr'];
const P3_ITEMS = ['flutter', 'push notification', 'callkit', 'connectionservice'];
const P4_ITEMS = ['crm', 'ai call summary', 'transcription', 'wallboard', 'supervisor', 'analytics'];

const RELEASES = ['v1.2', 'v1.3', 'v1.4', 'v1.5', 'v1.6', 'v2.0', 'v2.5', 'v3.0'];

const DEP_CHAIN = [
  ['warm transfer', 'conference'],
  ['conference', 'call parking'],
  ['call parking', 'call queue'],
  ['call queue', 'supervisor'],
];

const TEST_LAYERS = [
  'unit test',
  'integration test',
  'webrtc',
  'call control',
  'regression',
  'load test',
  'production validation',
];

const PERF_TIERS = ['100', '500', '1000', '5000'];

const SECURITY_TOPICS = ['jwt', 'tenant isolation', 'permission', 'audit', 'rate limit', 'webhook', 'secret', 'tls'];

const MOBILE_TOPICS = ['flutter', 'callkit', 'connectionservice', 'background call', 'push notification', 'offline'];

const AI_TOPICS = ['transcription', 'call summary', 'sentiment', 'search', 'knowledge base', 'voice bot'];

const ENTERPRISE_TOPICS = ['crm', 'sso', 'ldap', 'teams', 'slack', 'salesforce', 'zoho', 'hubspot'];

// Edges for circular dependency check (child requires parent)
const DEP_GRAPH = {
  'warm transfer': ['blind transfer'],
  conference: ['warm transfer'],
  'call parking': ['conference'],
  'call queue': ['call parking', 'ring group'],
  supervisor: ['call queue'],
  'call pickup': ['presence', 'warm transfer'],
  'ai call summary': ['transcription'],
  callkit: ['push notification'],
};

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

function read(name) {
  return fs.readFileSync(path.join(ROADMAP_DIR, name), 'utf8');
}

function hasAll(content, items, label) {
  const lower = content.toLowerCase();
  for (const item of items) {
    lower.includes(item.toLowerCase()) ? pass(`${label}: ${item}`) : fail(`${label} missing ${item}`);
  }
}

function hasCycle(graph) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) return node;
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    for (const dep of graph[node] || []) {
      const found = dfs(dep);
      if (found) return `${node} -> ${dep} (cycle near ${found})`;
    }
    stack.delete(node);
    return null;
  }

  for (const node of Object.keys(graph)) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return null;
}

console.log('VSP roadmap docs validation\n');

console.log('Documents:');
for (const name of DOCS) {
  fs.existsSync(path.join(ROADMAP_DIR, name)) ? pass(name) : fail(`missing ${name}`);
}

console.log('\nCurrent state:');
hasAll(read('01-current-state.md'), CURRENT_STATE_ITEMS, 'current');

console.log('\nPriority roadmap:');
const p2 = read('02-priority-roadmap.md');
hasAll(p2, P0_ITEMS, 'P0');
hasAll(p2, P1_ITEMS, 'P1');
hasAll(p2, P2_ITEMS, 'P2');
hasAll(p2, P3_ITEMS, 'P3');
hasAll(p2, P4_ITEMS, 'P4');

console.log('\nFeature dependencies:');
const deps = read('03-feature-dependencies.md').toLowerCase();
for (const [a, b] of DEP_CHAIN) {
  deps.includes(a) && deps.includes(b) ? pass(`chain: ${a} → ${b}`) : fail(`chain missing ${a} → ${b}`);
}
deps.includes('```mermaid') ? pass('dependency mermaid diagram') : fail('missing dependency mermaid');

console.log('\nCircular dependency check:');
const cycle = hasCycle(DEP_GRAPH);
cycle ? fail(`cycle detected: ${cycle}`) : pass('no cycles in dependency graph model');

console.log('\nRelease plan:');
hasAll(read('04-release-plan.md'), RELEASES, 'release');

console.log('\nTesting strategy:');
hasAll(read('05-testing-strategy.md'), TEST_LAYERS, 'testing');

console.log('\nPerformance plan:');
hasAll(read('06-performance-plan.md'), PERF_TIERS, 'concurrent tier');

console.log('\nSecurity plan:');
hasAll(read('07-security-plan.md'), SECURITY_TOPICS, 'security');

console.log('\nMobile roadmap:');
hasAll(read('08-mobile-roadmap.md'), MOBILE_TOPICS, 'mobile');

console.log('\nAI roadmap:');
hasAll(read('09-ai-roadmap.md'), AI_TOPICS, 'ai');

console.log('\nEnterprise roadmap:');
hasAll(read('10-enterprise-roadmap.md'), ENTERPRISE_TOPICS, 'enterprise');

console.log('\nInternal links:');
const readme = read('README.md');
const linkCount = (readme.match(/\(\.\/[0-9]{2}-[^)]+\.md\)/g) || []).length;
linkCount >= 10 ? pass(`README links ${linkCount} docs`) : fail(`README only ${linkCount} links`);

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} issue(s)`);
process.exit(failed === 0 ? 0 : 1);
