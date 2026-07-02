#!/usr/bin/env node
/**
 * Build Symplore vs Asuitech Desk→Desk trace comparison table from log files.
 *
 * Usage:
 *   node scripts/parse-desk-desk-comparison.js symplore.log asuitech.log
 *   docker compose logs api telephony-v3-worker 2>&1 | node scripts/parse-desk-desk-comparison.js --stdin symplore asuitech
 *
 * Log lines: JSON with message "[TRACE] ..." or browser logTelnyx "[TRACE] ..."
 */
const fs = require('fs');
const readline = require('readline');

const STAGES = [
  { key: 'dial_button', label: 'Dial Button', patterns: [/Dial Button Pressed/i] },
  { key: 'client_new_call', label: 'client.newCall', patterns: [/client\.newCall\(\)/i, /\[TRACE\] client\.newCall/i] },
  { key: 'webhook', label: 'Webhook', patterns: [/Webhook Received/i] },
  { key: 'bootstrap', label: 'bootstrapSession', patterns: [/bootstrapSessionAndLeg\(\)/i] },
  { key: 'gateway', label: 'Gateway', patterns: [/gateway\.handleV3WebhookIngress\(\)/i] },
  { key: 'desk_router', label: 'Desk Router', patterns: [/desk\.router\.start\(\)/i] },
  { key: 'load_target', label: 'Destination Resolver', patterns: [/loadTargetExtension\(\)/i] },
  { key: 'ring_targets', label: 'Ring Targets', patterns: [/resolveExtensionRingTargets\(\)/i] },
  { key: 'internal_ring', label: 'Internal Ring', patterns: [/beginInternalExtensionRing\(\)/i] },
  { key: 'telnyx_dial_req', label: 'Telnyx Dial Request', patterns: [/Dial Request/i] },
  { key: 'telnyx_dial_res', label: 'Telnyx Dial Response', patterns: [/Dial Response/i] },
  { key: 'call_completed', label: 'Call Completed', patterns: [/Call Completed/i] },
];

function parseTraceLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj = null;
  if (trimmed.startsWith('{')) {
    try {
      obj = JSON.parse(trimmed);
    } catch {
      obj = null;
    }
  }

  const haystack = obj?.message || trimmed;
  for (const stage of STAGES) {
    if (stage.patterns.some((re) => re.test(haystack))) {
      return {
        stage: stage.key,
        label: stage.label,
        ts: obj?.ts || null,
        tenantId: obj?.tenantId ?? null,
        tenantName: obj?.tenantName ?? null,
        extension: obj?.extensionNumber ?? obj?.extension ?? null,
        destination: obj?.targetExtension ?? obj?.destination ?? obj?.destinationNumber ?? null,
        callControlId: obj?.callControlId ?? null,
        raw: trimmed.slice(0, 240),
      };
    }
  }
  return null;
}

function ingestLines(text, bucket) {
  for (const line of text.split(/\r?\n/)) {
    const hit = parseTraceLine(line);
    if (hit) {
      if (!bucket[hit.stage]) bucket[hit.stage] = [];
      bucket[hit.stage].push(hit);
    }
  }
}

async function readFile(path) {
  return fs.promises.readFile(path, 'utf8');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function renderTable(nameA, hitsA, nameB, hitsB) {
  const rows = STAGES.map(({ key, label }) => {
    const a = hitsA[key]?.length ? '✅ Executed' : '❌ Never executed';
    const b = hitsB[key]?.length ? '✅ Executed' : '❌ Never executed';
    const diverge = hitsA[key]?.length && !hitsB[key]?.length ? '← Symplore only'
      : !hitsA[key]?.length && hitsB[key]?.length ? '← Asuitech only'
      : '';
    return { label, a, b, diverge };
  });

  let firstDivergence = null;
  for (const { key, label } of STAGES) {
    if (hitsA[key]?.length && !hitsB[key]?.length) {
      firstDivergence = { label, side: `${nameA} continues, ${nameB} stops before this stage` };
      break;
    }
    if (!hitsA[key]?.length && hitsB[key]?.length) {
      firstDivergence = { label, side: `${nameB} has trace, ${nameA} missing (unexpected)` };
      break;
    }
    if (!hitsA[key]?.length && !hitsB[key]?.length) {
      continue;
    }
  }

  console.log(`\nDesk→Desk trace comparison: ${nameA} vs ${nameB}\n`);
  console.log('| Stage | ' + nameA + ' | ' + nameB + ' | Notes |');
  console.log('| --- | --- | --- | --- |');
  for (const row of rows) {
    const note = row.diverge ? `**${row.diverge}**` : '';
    console.log(`| ${row.label} | ${row.a} | ${row.b} | ${note} |`);
  }

  if (firstDivergence) {
    console.log(`\nFIRST divergence: **${firstDivergence.label}** — ${firstDivergence.side}`);
  } else {
    console.log('\nNo stage-level divergence detected (both tenants hit the same stages, or both missing logs).');
  }

  const sipFallbackSignals = [
    ...(hitsA.ring_targets || []),
    ...(hitsB.ring_targets || []),
  ].filter((h) => /sip/i.test(h.raw));
  console.log('\nSIP fallback signal (resolveExtensionRingTargets with sip target):',
    sipFallbackSignals.length ? '✅ trace evidence present' : '❌ no sipTargets in captured traces');

  console.log('\nSample hits (first per stage):');
  for (const { key, label } of STAGES) {
    const sample = hitsA[key]?.[0] || hitsB[key]?.[0];
    if (sample) {
      console.log(`  ${label}:`, JSON.stringify({
        tenantId: sample.tenantId,
        extension: sample.extension,
        destination: sample.destination,
        callControlId: sample.callControlId,
        ts: sample.ts,
      }));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let nameA = 'Symplore';
  let nameB = 'Asuitech';
  let textA = '';
  let textB = '';

  if (args[0] === '--stdin' && args.length >= 3) {
    nameA = args[1];
    nameB = args[2];
    const all = await readStdin();
    const markerA = new RegExp(`tenant[=:]\\s*${nameA}|${nameA}`, 'i');
    const markerB = new RegExp(`tenant[=:]\\s*${nameB}|${nameB}`, 'i');
    for (const line of all.split(/\r?\n/)) {
      if (markerA.test(line)) textA += line + '\n';
      if (markerB.test(line)) textB += line + '\n';
    }
    if (!textA.trim() && !textB.trim()) {
      textA = all;
      textB = all;
    }
  } else if (args.length >= 2) {
    nameA = args[0].replace(/\.log$/i, '');
    nameB = args[1].replace(/\.log$/i, '');
    textA = await readFile(args[0]);
    textB = await readFile(args[1]);
  } else {
    console.error('Usage: node scripts/parse-desk-desk-comparison.js symplore.log asuitech.log');
    console.error('   or: docker compose logs api 2>&1 | node scripts/parse-desk-desk-comparison.js --stdin symplore asuitech');
    process.exit(1);
  }

  const hitsA = {};
  const hitsB = {};
  ingestLines(textA, hitsA);
  ingestLines(textB, hitsB);
  renderTable(nameA, hitsA, nameB, hitsB);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
