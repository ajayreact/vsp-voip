#!/usr/bin/env node
/**
 * scripts/trace-live-call.js
 *
 * READ-ONLY live call trace for a single desk-to-desk call (e.g. ext 100 -> ext 101).
 *
 * Does NOT modify: telephony routing, Redis, workers, webhook handlers, feature flags,
 * or any production configuration. Only reads:
 *   - Telnyx REST API (registration status, detail records, webhook deliveries)
 *   - Postgres (SIP usernames for the two extensions, via `docker compose exec postgres psql`)
 *   - Redis stream length + tail (via `docker compose exec redis redis-cli`, read-only commands)
 *   - `docker compose logs api` / `docker compose logs telephony-v3-worker`
 *   - /var/log/nginx/access.log
 *
 * MUST run on the EC2 HOST (not inside a container) from /opt/vsp-voip, because the
 * API/worker Docker image (node:22-alpine) has no docker CLI, no redis-cli, and no
 * nginx log file. It shells out to `docker compose ...` and reads the host nginx log.
 * No npm dependencies are required — only Node core modules (https, child_process, fs).
 *
 * Usage (on EC2 host):
 *   cd /opt/vsp-voip
 *   node scripts/trace-live-call.js --ext-a=100 --ext-b=101 --duration=20
 *
 * Options:
 *   --ext-a=100          Calling extension (default 100)
 *   --ext-b=101          Called extension (default 101)
 *   --duration=20        Seconds to wait after the prompt before collecting evidence
 *   --env-file=.env      Path to the .env file to read Telnyx IDs/key from (default .env)
 *
 * Prints a YES/NO timeline and stops at the first NO, per the fixed decision chain.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function arg(name, def = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const EXT_A = arg('ext-a', '100');
const EXT_B = arg('ext-b', '101');
const DURATION_SEC = Number(arg('duration', '20')) || 20;
const ENV_FILE = arg('env-file', '.env');

function loadEnvFile(file) {
  const map = {};
  try {
    const raw = fs.readFileSync(path.resolve(file), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      map[key] = val;
    }
  } catch (error) {
    console.warn(`WARN: could not read env file ${file}: ${error.message}`);
  }
  return map;
}

const fileEnv = loadEnvFile(ENV_FILE);
function env(name) {
  return process.env[name] || fileEnv[name] || null;
}

const TELNYX_API_KEY = env('TELNYX_API_KEY');
const CRED_CONN_ID = env('TELNYX_CREDENTIAL_CONNECTION_ID');
const LEGACY_APP_ID = env('TELNYX_CALL_CONTROL_APP_ID');
const V3_APP_ID = env('TELNYX_V3_CALL_CONTROL_APP_ID');

if (!TELNYX_API_KEY) {
  console.error(`FATAL: TELNYX_API_KEY not found in process.env or ${ENV_FILE}`);
  process.exit(2);
}
if (!CRED_CONN_ID) {
  console.warn('WARN: TELNYX_CREDENTIAL_CONNECTION_ID not set — sip-trunking CDR / registration checks will be skipped.');
}

function telnyxRequest(method, urlPath, { params = null, body = null } = {}) {
  return new Promise((resolve, reject) => {
    let fullPath = `/v2${urlPath}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined) qs.append(k, v);
      }
      fullPath += `?${qs.toString()}`;
    }
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.telnyx.com',
        path: fullPath,
        method,
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch (error) {
            resolve({ status: res.statusCode, body: null, parseError: error.message, raw: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Telnyx request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function sh(cmd) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) };
  } catch (error) {
    return { ok: false, out: (error.stdout || '') + (error.stderr || ''), error: error.message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lookupSipUsernames(extA, extB) {
  const query = `SELECT e."extensionNumber", u."telnyxSipUsername" FROM "Extension" e JOIN "User" u ON u.id = e."userId" WHERE e."extensionNumber" IN ('${extA}','${extB}');`;
  const result = sh(`docker compose exec -T postgres psql -U vsp -d vsp_voip -t -A -F '|' -c "${query.replace(/"/g, '\\"')}"`);
  const map = {};
  if (result.ok) {
    for (const line of result.out.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|');
      if (parts.length === 2 && parts[0] && parts[1]) map[parts[0]] = parts[1];
    }
  }
  return { map, raw: result };
}

async function checkRegistration(sipUsername) {
  if (!CRED_CONN_ID || !sipUsername) return { status: null, error: 'missing_connection_or_username' };
  const res = await telnyxRequest('post', `/credential_connections/${CRED_CONN_ID}/actions/check_registration_status`, {
    body: { sip_username: sipUsername },
  });
  return { status: res.body?.data?.status || res.body?.status || null, httpStatus: res.status };
}

function withinWindow(isoString, t0, t1, bufferMs = 5000) {
  if (!isoString) return false;
  const t = new Date(isoString).getTime();
  if (Number.isNaN(t)) return false;
  return t >= (t0 - bufferMs) && t <= (t1 + bufferMs);
}

async function fetchDetailRecords(params) {
  const res = await telnyxRequest('get', '/detail_records', { params: { 'page[size]': 10, ...params } });
  return res.body?.data || [];
}

async function fetchWebhookDeliveries(limit = 20) {
  const res = await telnyxRequest('get', '/webhook_deliveries', { params: { 'page[size]': limit } });
  return res.body?.data || [];
}

function grepNginx(t0, t1) {
  const file = '/var/log/nginx/access.log';
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const lines = raw.split('\n').filter((l) => l.includes('POST') && /webhook\/(v3\/)?call-control/.test(l));
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const inWindow = lines.filter((l) => {
      const m = l.match(/\[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/);
      if (!m) return false;
      const d = new Date(Date.UTC(Number(m[3]), months[m[2]], Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])));
      return withinWindow(d.toISOString(), t0, t1);
    });
    return { ok: true, file, totalWebhookLines: lines.length, inWindow };
  } catch (error) {
    return { ok: false, file, error: error.message };
  }
}

function dockerLogs(service, sinceArg) {
  return sh(`docker compose logs ${service} --since ${sinceArg} 2>&1`);
}

async function main() {
  console.log('='.repeat(72));
  console.log('LIVE CALL TRACE — read-only, no telephony/routing/Redis/worker/webhook/flag changes');
  console.log(`Extensions: ${EXT_A} -> ${EXT_B}   Post-dial window: ${DURATION_SEC}s`);
  console.log('='.repeat(72));

  const { map: sipUsernames, raw: dbLookupRaw } = lookupSipUsernames(EXT_A, EXT_B);
  console.log('\n--- DB SIP usernames ---');
  console.log(JSON.stringify(sipUsernames, null, 2));
  if (!dbLookupRaw.ok) console.log('DB lookup command failed:', dbLookupRaw.out || dbLookupRaw.error);

  const usernameA = sipUsernames[EXT_A] || null;
  const usernameB = sipUsernames[EXT_B] || null;

  console.log('\n--- Grandstream / SIP registration BEFORE call (Telnyx registration status) ---');
  const regABefore = await checkRegistration(usernameA);
  const regBBefore = await checkRegistration(usernameB);
  console.log(`ext ${EXT_A} (${usernameA}): ${regABefore.status}`);
  console.log(`ext ${EXT_B} (${usernameB}): ${regBBefore.status}`);

  const xlenBeforeRaw = sh('docker compose exec -T redis redis-cli XLEN v3:stream:telephony-ingress');
  const xlenBefore = parseInt((xlenBeforeRaw.out || '').replace(/\D/g, ''), 10) || 0;
  console.log(`\nRedis v3:stream:telephony-ingress XLEN before: ${xlenBefore}`);

  const t0 = Date.now();
  console.log('\n' + '*'.repeat(72));
  console.log(`*** DIAL NOW: extension ${EXT_A} -> extension ${EXT_B} ***`);
  console.log(`*** T0 = ${new Date(t0).toISOString()} — let it ring, then hang up within ${DURATION_SEC}s ***`);
  console.log('*'.repeat(72) + '\n');

  await sleep(DURATION_SEC * 1000);

  const t1 = Date.now();
  console.log(`T1 = ${new Date(t1).toISOString()}\n`);

  console.log('--- Registration AFTER call ---');
  const regAAfter = await checkRegistration(usernameA);
  const regBAfter = await checkRegistration(usernameB);
  console.log(`ext ${EXT_A} (${usernameA}): ${regAAfter.status}`);
  console.log(`ext ${EXT_B} (${usernameB}): ${regBAfter.status}`);

  const xlenAfterRaw = sh('docker compose exec -T redis redis-cli XLEN v3:stream:telephony-ingress');
  const xlenAfter = parseInt((xlenAfterRaw.out || '').replace(/\D/g, ''), 10) || 0;
  const xrange = sh('docker compose exec -T redis redis-cli XRANGE v3:stream:telephony-ingress - + COUNT 10');
  console.log('\n--- Redis stream delta ---');
  console.log(`XLEN before=${xlenBefore} after=${xlenAfter} delta=${xlenAfter - xlenBefore}`);
  console.log(xrange.ok ? xrange.out : `XRANGE failed: ${xrange.error}`);

  console.log('\n--- Telnyx sip-trunking CDR (today, credential connection) ---');
  const sipCdrs = CRED_CONN_ID ? await fetchDetailRecords({
    'filter[record_type]': 'sip-trunking',
    'filter[connection_id]': CRED_CONN_ID,
    'filter[date_range]': 'today',
  }) : [];
  console.log(JSON.stringify(sipCdrs, null, 2));
  const sipCdrInWindow = sipCdrs.filter((r) => withinWindow(r.started_at, t0, t1));

  console.log('\n--- Telnyx call-control CDR (today, legacy app) ---');
  const legacyCdrs = LEGACY_APP_ID ? await fetchDetailRecords({
    'filter[record_type]': 'call-control',
    'filter[connection_id]': LEGACY_APP_ID,
    'filter[date_range]': 'today',
  }) : [];
  console.log(JSON.stringify(legacyCdrs, null, 2));

  console.log('\n--- Telnyx call-control CDR (today, V3 app) ---');
  const v3Cdrs = V3_APP_ID ? await fetchDetailRecords({
    'filter[record_type]': 'call-control',
    'filter[connection_id]': V3_APP_ID,
    'filter[date_range]': 'today',
  }) : [];
  console.log(JSON.stringify(v3Cdrs, null, 2));
  const callControlCdrInWindow = [...legacyCdrs, ...v3Cdrs].filter((r) => withinWindow(r.started_at, t0, t1));

  console.log('\n--- Telnyx webhook deliveries (latest 20) ---');
  const deliveries = await fetchWebhookDeliveries(20);
  console.log(JSON.stringify(deliveries, null, 2));
  const deliveryInWindow = deliveries.filter((d) => withinWindow(d.created_at, t0, t1));

  console.log('\n--- Nginx access log (POST .../webhook/(v3/)?call-control) ---');
  const nginx = grepNginx(t0, t1);
  console.log(JSON.stringify(nginx, null, 2));

  console.log('\n--- API logs (docker compose logs api) ---');
  const apiLogs = dockerLogs('api', `${DURATION_SEC + 30}s`);
  const apiRelevant = (apiLogs.out || '').split('\n').filter((l) => /\[TRACE\]|ingress\.|Call Control event|V3 app outbound|handleParkedWebRtc|deskRouter|enqueue|v3_call_control_webhook_error/.test(l));
  console.log(apiRelevant.length ? apiRelevant.join('\n') : '(no matching lines)');

  console.log('\n--- Worker logs (docker compose logs telephony-v3-worker) ---');
  const workerLogs = dockerLogs('telephony-v3-worker', `${DURATION_SEC + 30}s`);
  const workerRelevant = (workerLogs.out || '').split('\n').filter((l) => /\[TRACE\]|\[V3\] deskRouter|ingress|worker\.job|dispatchIngress|ANSWER|DIAL|command/.test(l));
  console.log(workerRelevant.length ? workerRelevant.join('\n') : '(no matching lines)');

  const steps = [
    {
      label: 'INVITE left phone?',
      value: 'UNKNOWN',
      note: 'Not observable from the server. Requires Grandstream device call log / syslog for this timestamp.',
    },
    {
      label: 'Telnyx received INVITE? (sip-trunking CDR in window)',
      value: sipCdrInWindow.length > 0 ? 'YES' : (CRED_CONN_ID ? 'NO' : 'UNKNOWN (no credential connection id configured)'),
    },
    {
      label: 'sip-trunking CDR created?',
      value: sipCdrInWindow.length > 0 ? 'YES' : (CRED_CONN_ID ? 'NO' : 'UNKNOWN'),
    },
    {
      label: 'Call Control webhook generated? (call-control CDR in window)',
      value: callControlCdrInWindow.length > 0 ? 'YES' : 'NO',
    },
    {
      label: 'Webhook delivered? (webhook_deliveries in window)',
      value: deliveryInWindow.length > 0 ? 'YES' : 'NO',
    },
    {
      label: 'nginx received POST?',
      value: nginx.ok ? (nginx.inWindow.length > 0 ? 'YES' : 'NO') : 'UNKNOWN (nginx log unreadable by this user)',
    },
    {
      label: 'API processed webhook?',
      value: apiRelevant.length > 0 ? 'YES' : 'NO',
    },
    {
      label: 'Redis enqueue?',
      value: xlenAfter > xlenBefore ? 'YES' : 'NO',
    },
    {
      label: 'Worker processed?',
      value: workerRelevant.length > 0 ? 'YES' : 'NO',
    },
    {
      label: 'deskRouter executed?',
      value: workerRelevant.some((l) => l.includes('deskRouter')) ? 'YES' : 'NO',
    },
    {
      label: 'ANSWER command?',
      value: workerRelevant.some((l) => /ANSWER/.test(l)) ? 'YES' : 'NO',
    },
    {
      label: 'DIAL command?',
      value: workerRelevant.some((l) => /DIAL/.test(l)) ? 'YES' : 'NO',
    },
    {
      label: 'Call bridged?',
      value: 'UNKNOWN (verify manually — not reliably derivable from detail_records alone)',
    },
  ];

  console.log('\n' + '='.repeat(72));
  console.log('TIMELINE');
  console.log('='.repeat(72));
  console.log('Phone');
  let stoppedAt = null;
  let stoppedIndex = -1;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    console.log('  |');
    console.log(`  v  ${step.label}  =>  ${step.value}${step.note ? `  (${step.note})` : ''}`);
    if (step.value === 'NO' && !stoppedAt) {
      stoppedAt = step;
      stoppedIndex = i;
      break;
    }
  }

  console.log('\n' + '='.repeat(72));
  if (stoppedAt) {
    console.log(`FIRST NO: ${stoppedAt.label}`);
    const webhookGenIndex = steps.findIndex((s) => s.label.startsWith('Call Control webhook generated'));
    if (stoppedIndex <= webhookGenIndex) {
      console.log('\nThe failure is outside the VSP application.');
    } else {
      console.log('\nFailure is inside the VSP application (after webhook generation).');
      console.log('Identify the exact function from the API/worker log lines printed above.');
    }
  } else {
    console.log('No definitive NO found in the server-observable chain.');
    console.log('"INVITE left phone?" requires manual confirmation from the Grandstream device log.');
  }
  console.log('='.repeat(72));
}

main().catch((error) => {
  console.error('FATAL:', error);
  process.exit(1);
});
