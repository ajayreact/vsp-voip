#!/usr/bin/env node
/**
 * Pre-production release checklist — automated gates.
 * Run before every production deployment:
 *   npm run release:checklist
 * Against staging/production API:
 *   API_BASE=https://api.example.com npm run release:checklist
 */
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const skipLoad = args.includes('--skip-load');
const skipBrowser = args.includes('--skip-browser');

const checks = [];
let failed = 0;

function runStep(name, cmd, cmdArgs, optional = false) {
  console.log(`\n▶ ${name}`);
  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  const ok = result.status === 0;
  checks.push({ name, ok: optional ? ok || 'warn' : ok });
  if (!ok && !optional) failed += 1;
  return ok;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

console.log('VSP Phone — Release Checklist\n');

// 1. Framework integrity
runStep('QA framework structure', 'node', ['scripts/validate-tests-framework.js']);

// 2. Unit + integration tests
runStep('Vitest suite', 'npx', ['vitest', 'run', '--config', 'vitest.config.ts']);

// 3. Deployment smoke
runStep('Deploy smoke script', 'node', ['scripts/smoke-deploy.js']);

// 4. P0 launch validation (env + readiness when API reachable)
runStep('P0 launch validation', 'node', ['scripts/validate-p0-launch.js'], true);

// 5. Messaging load smoke (optional k6)
if (!skipLoad) {
  try {
    execSync('k6 version', { stdio: 'pipe' });
    runStep('Messaging k6 smoke', 'k6', ['run', 'tests/performance/k6-messaging-smoke.js'], true);
  } catch {
    console.log('\n▶ Messaging k6 smoke — skipped (k6 not installed)');
    checks.push({ name: 'Messaging k6 smoke', ok: 'warn' });
  }
}

// 6. Browser tests (optional)
if (!skipBrowser && process.env.QA_BROWSER_TESTS === 'true') {
  runStep('Playwright portal tests', 'npx', ['playwright', 'test', '--config', 'tests/playwright.config.ts'], true);
} else {
  console.log('\n▶ Playwright — skipped (set QA_BROWSER_TESTS=true)');
}

// 7. Static release artifacts
console.log('\n▶ Release documentation');
const docs = [
  'docs/qa/release-checklist.md',
  'docs/qa/production-monitoring.md',
];
for (const doc of docs) {
  if (fileExists(doc)) {
    console.log(`  ✓ ${doc}`);
    checks.push({ name: doc, ok: true });
  } else {
    console.error(`  ✗ missing ${doc}`);
    failed += 1;
    checks.push({ name: doc, ok: false });
  }
}

// 8. Mobile typecheck (non-blocking warning)
runStep('Mobile typecheck', 'npm', ['run', 'typecheck', '--prefix', 'mobile-rn'], true);

console.log('\n--- Release Checklist Summary ---');
for (const c of checks) {
  const icon = c.ok === true ? '✓' : c.ok === 'warn' ? '⚠' : '✗';
  console.log(`  ${icon} ${c.name}`);
}

console.log(`\n${failed === 0 ? 'READY FOR DEPLOY' : 'NOT READY'} — ${failed} blocking failure(s)`);
process.exit(failed === 0 ? 0 : 1);
