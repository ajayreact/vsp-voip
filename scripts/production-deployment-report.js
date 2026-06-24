#!/usr/bin/env node
/**
 * Remote production deployment verification report.
 * Usage: node scripts/production-deployment-report.js
 */
require('dotenv').config();
const { execSync } = require('child_process');

const API_URL = process.env.API_URL || 'https://api.vspphone.com';
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';
const REQUIRED_COMMITS = [
  { sha: '12b0ea6acd0b1f19e2b324a132c907a52850a5c6', label: 'bridge-race + call-accepted endpoint' },
  { sha: '527b0cafd7b6128cccaece554f72372326ae1726', label: 'inbound bridge drop fix' },
];

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: res.status, body };
}

function localGit(ref) {
  try {
    const sha = execSync(`git rev-parse ${ref}`, { encoding: 'utf8' }).trim();
    const subject = execSync(`git log -1 --format=%s ${ref}`, { encoding: 'utf8' }).trim();
    return `${sha} ${subject}`;
  } catch {
    return null;
  }
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    apiUrl: API_URL,
    github: {
      originMain: localGit('origin/main'),
    },
    requiredCommits: REQUIRED_COMMITS,
    production: {},
    callAcceptedRoute: {},
    deploymentStatus: 'UNKNOWN',
    actionRequired: [],
  };

  const health = await fetchJson(`${API_URL}/health`);
  const ready = await fetchJson(`${API_URL}/ready`);
  report.production.health = health;
  report.production.ready = ready;

  const unauth = await fetchJson(`${API_URL}/api/softphone/call-accepted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  report.callAcceptedRoute.unauthenticated = {
    status: unauth.status,
    body: unauth.body,
  };

  const login = await fetchJson(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  report.production.loginStatus = login.status;

  if (login.status === 200 && login.body?.accessToken) {
    const authed = await fetchJson(`${API_URL}/api/softphone/call-accepted`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.body.accessToken}`,
      },
      body: '{}',
    });
    report.callAcceptedRoute.authenticatedIdle = {
      status: authed.status,
      body: authed.body,
    };
  }

  const deployedCommit = ready.body?.build?.gitCommit || null;
  report.production.deployedGitCommit = deployedCommit;
  report.production.uptimeSeconds = ready.body?.uptimeSeconds ?? health.body?.uptimeSeconds ?? null;

  if (unauth.status === 404) {
    report.deploymentStatus = 'STALE — call-accepted missing';
    report.actionRequired.push(
      'SSH to EC2 and run: cd /opt/vsp-voip && git pull origin main && bash deploy/deploy-api.sh',
    );
  } else if (unauth.status === 401) {
    const idle = report.callAcceptedRoute.authenticatedIdle;
    if (idle?.status === 200 && idle.body?.reason === 'no_pending_ring') {
      report.deploymentStatus = 'OK — bridge-grace endpoint deployed';
    } else {
      report.deploymentStatus = 'PARTIAL — route exists but idle response unexpected';
      report.actionRequired.push('Inspect authenticated call-accepted response in report');
    }
  } else {
    report.deploymentStatus = `UNEXPECTED — unauth status ${unauth.status}`;
  }

  if (deployedCommit) {
    for (const req of REQUIRED_COMMITS) {
      try {
        execSync(`git merge-base --is-ancestor ${req.sha} ${deployedCommit}`, { stdio: 'ignore' });
        req.includedInProduction = true;
      } catch {
        req.includedInProduction = false;
        report.actionRequired.push(`Production commit ${deployedCommit} missing ${req.sha}`);
      }
    }
  } else {
    report.actionRequired.push(
      'Production /ready has no build.gitCommit — redeploy with deploy/deploy-api.sh after pulling latest',
    );
  }

  console.log(JSON.stringify(report, null, 2));

  if (report.deploymentStatus.startsWith('STALE') || report.deploymentStatus.startsWith('PARTIAL')) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
