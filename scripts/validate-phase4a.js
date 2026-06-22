#!/usr/bin/env node
/**
 * Phase 4A validation — npm run validate:phase4a
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

async function main() {
  console.log('\n=== Phase 4A Extension Management Validation ===\n');

  const schemaChecks = [
    ['model Extension', /model Extension \{/],
    ['model ExtensionForwarding', /model ExtensionForwarding \{/],
    ['model ExtensionDevice', /model ExtensionDevice \{/],
    ['model ExtensionSecurity', /model ExtensionSecurity \{/],
    ['model ExtensionVoicemailSettings', /model ExtensionVoicemailSettings \{/],
    ['enum ExtensionStatus', /enum ExtensionStatus/],
  ];

  const schema = read('prisma/schema.prisma');
  for (const [name, re] of schemaChecks) {
    if (re.test(schema)) pass(`Schema: ${name}`);
    else fail(`Schema: ${name}`);
  }

  if (fileExists('prisma/migrations/20260621210000_phase4a_extensions/migration.sql')) {
    pass('Migration file phase4a_extensions');
  } else {
    fail('Migration file phase4a_extensions');
  }

  if (fileExists('lib/extensions.js')) pass('lib/extensions.js');
  else fail('lib/extensions.js');

  if (fileExists('routes/extensions.js')) pass('routes/extensions.js');
  else fail('routes/extensions.js');

  const portal = read('routes/portal.js');
  if (portal.includes("require('./extensions')") && portal.includes('router.use(extensionRoutes)')) {
    pass('Portal mounts extension routes');
  } else {
    fail('Portal mounts extension routes');
  }

  const api = read('web/src/lib/api.ts');
  if (api.includes('getExtensions') && api.includes('createExtension')) {
    pass('Web API client extension functions');
  } else {
    fail('Web API client extension functions');
  }

  const uiPages = [
    'web/src/app/(app)/phone-system/extensions/page.tsx',
    'web/src/app/(app)/phone-system/extensions/new/page.tsx',
    'web/src/app/(app)/phone-system/extensions/[id]/page.tsx',
    'web/src/app/(app)/phone-system/devices/page.tsx',
    'web/src/components/phone-system-nav.tsx',
    'docs/PHASE4A-GAP-ANALYSIS.md',
  ];

  for (const page of uiPages) {
    if (fileExists(page)) pass(`File: ${page}`);
    else fail(`File: ${page}`);
  }

  const sidebar = read('web/src/components/sidebar.tsx');
  if (sidebar.includes('/phone-system/extensions')) pass('Sidebar Phone system link');
  else fail('Sidebar Phone system link');

  try {
    const { getPrisma } = require('../db');
    const prisma = await getPrisma();
    const models = [
      'extension',
      'extensionForwarding',
      'extensionDevice',
      'extensionSecurity',
      'extensionVoicemailSettings',
    ];
    for (const model of models) {
      if (typeof prisma[model]?.findMany === 'function') pass(`Prisma client: ${model}`);
      else fail(`Prisma client: ${model} — run prisma generate`);
    }
  } catch (err) {
    fail('Prisma client check', err.message);
  }

  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
