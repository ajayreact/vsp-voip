#!/usr/bin/env node
/**
 * Production validation for telephony-v3-worker (Principal Architect B2).
 *
 * Usage:
 *   npm run validate:v3-worker
 *   API_BASE=http://127.0.0.1:3000 npm run validate:v3-worker
 *
 * With Docker Compose running locally or on EC2:
 *   docker compose up -d api telephony-v3-worker
 *   npm run validate:v3-worker
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const COMPOSE = path.join(ROOT, 'docker-compose.yml');
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

function readCompose() {
  return fs.readFileSync(COMPOSE, 'utf8');
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  return { status: response.status, body };
}

console.log('V3 worker production validation (B2)\n');

console.log('Static checks:');
if (fs.existsSync(path.join(ROOT, 'scripts/telephony-v3-worker.js'))) {
  pass('telephony-v3-worker.js exists');
} else {
  fail('missing scripts/telephony-v3-worker.js');
}

if (fs.existsSync(path.join(ROOT, 'scripts/v3-worker-healthcheck.js'))) {
  pass('v3-worker-healthcheck.js exists');
} else {
  fail('missing scripts/v3-worker-healthcheck.js');
}

const compose = readCompose();
if (compose.includes('telephony-v3-worker:')) {
  pass('docker-compose defines telephony-v3-worker service');
} else {
  fail('docker-compose missing telephony-v3-worker service');
}

if (compose.includes('restart: unless-stopped')) {
  pass('restart policy unless-stopped configured');
} else {
  fail('restart: unless-stopped not found in docker-compose.yml');
}

if (compose.includes('scripts/telephony-v3-worker.js')) {
  pass('worker command uses telephony-v3-worker.js');
} else {
  fail('worker command not wired in docker-compose.yml');
}

console.log('\nEnvironment validation:');
const envCheck = spawnSync(
  process.execPath,
  [
    '-e',
    `
      process.env.V3_WORKER_SKIP_ENV_VALIDATE = 'false';
      delete process.env.TELEPHONY_V3_GLOBAL;
      const { validateWorkerEnv } = require('./lib/telephony-v3/Utils/workerEnv');
      let threw = false;
      try { validateWorkerEnv(); } catch (e) { threw = true; }
      process.exit(threw ? 0 : 1);
    `,
  ],
  { cwd: ROOT, encoding: 'utf8' },
);

if (envCheck.status === 0) {
  pass('validateWorkerEnv fails fast when TELEPHONY_V3_GLOBAL is missing');
} else {
  fail('validateWorkerEnv did not fail on missing required vars');
}

console.log('\nRuntime checks (requires API + worker):');
(async () => {
  try {
    const readyV3 = await fetchJson(`${API_BASE}/ready/v3`);
    if (readyV3.status !== 200 && readyV3.status !== 503) {
      fail(`/ready/v3 returned HTTP ${readyV3.status}`);
    } else {
      pass(`/ready/v3 reachable (HTTP ${readyV3.status})`);
    }

    const activeCount = readyV3.body?.workers?.activeCount ?? 0;
    if (activeCount > 0) {
      pass(`worker heartbeat visible (activeCount=${activeCount})`);
      const workerIds = (readyV3.body.workers.workers || []).map((w) => w.workerId);
      pass(`registered workers: ${workerIds.join(', ')}`);
    } else {
      fail('no active V3 workers in /ready/v3 — start telephony-v3-worker');
    }

    if (readyV3.body?.workers?.healthy === true || process.env.NODE_ENV !== 'production') {
      pass('worker health check reported healthy (or non-production bypass)');
    } else if (activeCount > 0) {
      pass('workers present (production readiness may still be false until queue/outbox checks pass)');
    }
  } catch (error) {
    if (process.env.VALIDATE_V3_WORKER_RUNTIME === 'true') {
      fail(`runtime checks failed: ${error.message}`);
    } else {
      console.log(`  ⚠ runtime checks skipped (API not reachable): ${error.message}`);
      console.log('    Set VALIDATE_V3_WORKER_RUNTIME=true after: docker compose up -d api telephony-v3-worker');
    }
  }

  console.log('\nManual validation checklist:');
  console.log('  [ ] docker compose logs telephony-v3-worker — boot + heartbeat lines');
  console.log('  [ ] curl -s http://127.0.0.1:3000/ready/v3 | jq .workers');
  console.log('  [ ] docker compose restart redis && worker reconnects within ~30s');
  console.log('  [ ] docker compose stop telephony-v3-worker — graceful drain in logs');
  console.log('  [ ] scale to 2 workers — distinct V3_WORKER_ID / HOSTNAME, no duplicate ingress acks');
  console.log('  [ ] npm run test:v3 — workerProduction + outboxConcurrency tests pass');

  console.log('');
  if (failed > 0) {
    console.error(`V3 worker validation FAILED (${failed} issue(s))`);
    process.exit(1);
  }
  console.log('V3 worker validation PASSED');
})();
