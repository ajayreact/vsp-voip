#!/usr/bin/env node
/**
 * B3 — Run V3 integration tests against real PostgreSQL + Redis.
 *
 * Usage:
 *   npm run test:v3:integration
 *   npm run test:v3:integration -- --no-docker   # use existing DATABASE_URL / REDIS_URL
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const skipDocker = args.includes('--no-docker');

const INTEGRATION_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL
  || 'postgresql://vsp:vsp@localhost:5433/vsp_voip_integration';
const INTEGRATION_REDIS_URL =
  process.env.INTEGRATION_REDIS_URL
  || 'redis://localhost:6380';

function run(cmd, cmdArgs, env = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('==> V3 integration test runner (B3)\n');

if (!skipDocker) {
  console.log('==> Starting docker-compose.integration.yml');
  run('docker', ['compose', '-f', 'docker-compose.integration.yml', 'up', '-d', '--wait']);
}

const env = {
  V3_INTEGRATION: '1',
  DATABASE_URL: process.env.DATABASE_URL || INTEGRATION_DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL || INTEGRATION_REDIS_URL,
  TELEPHONY_V3_GLOBAL: 'true',
  TELEPHONY_V3_INGRESS_ENABLED: 'true',
  TELEPHONY_V3_CALLMANAGER_ENABLED: 'true',
  TELEPHONY_V3_EXECUTOR_ENABLED: 'true',
  TELEPHONY_V3_REDIS_REQUIRED: 'true',
  V3_METRICS_REDIS_MIRROR: 'false',
  NODE_ENV: 'test',
  JWT_SECRET: process.env.JWT_SECRET || 'integration-test-secret',
};

console.log('==> Applying migrations');
run('npx', ['prisma', 'migrate', 'deploy'], env);

console.log('==> Running integration tests (real PG + Redis)');
run(
  'npx',
  [
    'vitest',
    'run',
    '--config',
    'vitest.config.ts',
    'tests/telephony-v3/integration/realInfra.test.ts',
    '--pool=forks',
    '--maxWorkers=1',
  ],
  env,
);

console.log('\n==> V3 integration tests PASSED');
