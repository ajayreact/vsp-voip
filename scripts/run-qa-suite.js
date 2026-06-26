#!/usr/bin/env node
/**
 * VSP Phone QA suite orchestrator.
 * Usage:
 *   npm run qa
 *   npm run qa:full
 *   API_BASE=https://api.vspphone.com QA_BROWSER_TESTS=true npm run qa
 */
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildReport, writeHtmlReport } = require('../tests/lib/report-html.js');

const args = process.argv.slice(2);
const fullTelephony = args.includes('--full-telephony');
const skipBrowser = args.includes('--skip-browser');
const apiBase = process.env.API_BASE || process.env.API_URL || 'http://localhost:3000';
const webBase = process.env.WEB_BASE || process.env.WEB_URL || 'http://localhost:3001';
const started = Date.now();
const suites = {};
let exitCode = 0;

function run(cmd, cmdArgs, suiteName) {
  console.log(`\n==> ${suiteName}: ${cmd} ${cmdArgs.join(' ')}`);
  const t0 = Date.now();
  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  suites[suiteName] = [{
    name: suiteName,
    suite: suiteName,
    status: result.status === 0 ? 'pass' : 'fail',
    durationMs: Date.now() - t0,
    detail: result.status === 0 ? 'ok' : `exit ${result.status}`,
  }];
  if (result.status !== 0) exitCode = 1;
  return result.status === 0;
}

fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });

run('npx', ['vitest', 'run', '--config', 'vitest.config.ts'], 'vitest');

const vitestJson = path.join(process.cwd(), 'reports', 'vitest-results.json');
if (fs.existsSync(vitestJson)) {
  try {
    const prior = JSON.parse(fs.readFileSync(vitestJson, 'utf8'));
    suites.vitestCases = (prior.testResults || []).flatMap((file) =>
      (file.assertionResults || []).map((a) => ({
        name: a.fullName || a.title,
        suite: path.basename(file.name, path.extname(file.name)),
        status: a.status === 'passed' ? 'pass' : a.status === 'skipped' ? 'skip' : 'fail',
        durationMs: a.duration,
        detail: (a.failureMessages && a.failureMessages[0]) ? String(a.failureMessages[0]).slice(0, 200) : '',
      })),
    );
  } catch {
    /* ignore parse errors */
  }
}

run('node', ['scripts/validate-p0-launch.js'], 'validate-p0');

if (fullTelephony) {
  for (const script of [
    'validate:blind-transfer',
    'validate:call-transfer-session',
    'validate:rapid-accept-stress',
    'validate:extension-did',
  ]) {
    run('npm', ['run', script], script);
  }
}

if (!skipBrowser && process.env.QA_BROWSER_TESTS === 'true') {
  run('npx', ['playwright', 'test', '--config', 'tests/playwright.config.ts'], 'playwright');
} else {
  suites.playwright = [{
    name: 'browser tests',
    suite: 'playwright',
    status: 'skip',
    detail: 'Set QA_BROWSER_TESTS=true',
  }];
}

run('node', ['scripts/validate-tests-framework.js'], 'framework-validation');

let gitCommit;
try {
  gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch {
  gitCommit = undefined;
}

const report = buildReport(suites, { apiBase, webBase, gitCommit });
report.summary.durationMs = Date.now() - started;
const html = writeHtmlReport(report);
console.log(`\n==> QA HTML report: ${html}`);
console.log(`==> QA suite ${exitCode === 0 ? 'PASSED' : 'FAILED'} (${Date.now() - started}ms)`);
process.exit(exitCode);
