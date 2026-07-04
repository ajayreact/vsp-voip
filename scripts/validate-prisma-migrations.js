#!/usr/bin/env node
/**
 * Validates Prisma migration folder ordering and SQL dependencies.
 * Ensures `prisma migrate deploy` can succeed on a fresh PostgreSQL database.
 *
 * Usage: node scripts/validate-prisma-migrations.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations');

/** Explicit ordering rules from production audits (folder name suffixes). */
const ORDERED_SUFFIXES = [
  ['extension_provisioning_tokens', 'extension_provisioning_purpose'],
  ['v3_telephony_phase1', 'v3_telephony_phase1_5_hardening', 'v3_phase395_hardening'],
];

/** Renamed migrations — document remediation for DBs that applied old names. */
const RENAMED_MIGRATIONS = [
  {
    old: '20250624120000_extension_provisioning_purpose',
    next: '20260622125000_extension_provisioning_purpose',
  },
  {
    old: '20260624180000_v3_telephony_phase1_5_hardening',
    next: '20260624181000_v3_telephony_phase1_5_hardening',
  },
  {
    old: '20260626120000_v3_telephony_phase1',
    next: '20260624180500_v3_telephony_phase1',
  },
];

let failed = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed += 1;
}

function listMigrationDirs() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
   .sort();
}

function migrationSuffix(name) {
  const idx = name.indexOf('_');
  return idx === -1 ? name : name.slice(idx + 1);
}

function migrationTimestamp(name) {
  const idx = name.indexOf('_');
  return idx === -1 ? name : name.slice(0, idx);
}

function readMigrationSql(dirName) {
  const file = path.join(MIGRATIONS_DIR, dirName, 'migration.sql');
  if (!fs.existsSync(file)) {
    fail(`${dirName}: missing migration.sql`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function extractCreates(sql) {
  const tables = new Set();
  const types = new Set();
  for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi)) {
    tables.add(m[1]);
  }
  for (const m of sql.matchAll(/CREATE TYPE\s+"([^"]+)"/gi)) {
    types.add(m[1]);
  }
  return { tables, types };
}

function extractAlterTargets(sql) {
  const tables = new Set();
  const types = new Set();
  for (const m of sql.matchAll(/ALTER TABLE\s+"([^"]+)"/gi)) {
    tables.add(m[1]);
  }
  for (const m of sql.matchAll(/ALTER TYPE\s+"([^"]+)"/gi)) {
    types.add(m[1]);
  }
  return { tables, types };
}

function indexOfSuffix(dirs, suffix) {
  return dirs.findIndex((d) => migrationSuffix(d) === suffix);
}

console.log('Prisma migration ordering validation\n');

const dirs = listMigrationDirs();
if (dirs.length === 0) {
  fail('no migration directories found');
  process.exit(1);
}

console.log(`Found ${dirs.length} migrations\n`);

console.log('Timestamp uniqueness:');
const byTimestamp = new Map();
for (const dir of dirs) {
  const ts = migrationTimestamp(dir);
  if (!byTimestamp.has(ts)) byTimestamp.set(ts, []);
  byTimestamp.get(ts).push(dir);
}
for (const [ts, names] of byTimestamp) {
  if (names.length > 1) {
    fail(`duplicate timestamp ${ts}: ${names.join(', ')}`);
  } else {
    pass(`${ts} → ${names[0]}`);
  }
}

console.log('\nExplicit ordering rules:');
for (const chain of ORDERED_SUFFIXES) {
  const indices = chain.map((suffix) => {
    const idx = indexOfSuffix(dirs, suffix);
    if (idx === -1) {
      fail(`missing migration suffix: ${suffix}`);
      return -1;
    }
    return idx;
  });
  if (indices.some((i) => i < 0)) continue;
  let ok = true;
  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] <= indices[i - 1]) {
      fail(`${chain[i - 1]} must run before ${chain[i]} (index ${indices[i - 1]} vs ${indices[i]})`);
      ok = false;
    }
  }
  if (ok) pass(chain.join(' → '));
}

console.log('\nSQL dependency scan (ALTER targets must exist):');
const knownTables = new Set();
const knownTypes = new Set();

for (const dir of dirs) {
  const sql = readMigrationSql(dir);
  if (!sql) continue;

  const creates = extractCreates(sql);
  for (const table of creates.tables) knownTables.add(table);
  for (const type of creates.types) knownTypes.add(type);

  const alters = extractAlterTargets(sql);
  for (const table of alters.tables) {
    if (!knownTables.has(table)) {
      fail(`${dir}: ALTER TABLE "${table}" before table is created`);
    }
  }
  for (const type of alters.types) {
    if (!knownTypes.has(type)) {
      fail(`${dir}: ALTER TYPE "${type}" before type is created`);
    }
  }
}

if (failed === 0) {
  pass('all ALTER targets resolved in chronological order');
}

console.log('\nRenamed migration remediation (if old names exist in _prisma_migrations):');
for (const { old: oldName, next: newName } of RENAMED_MIGRATIONS) {
  console.log(`  UPDATE "_prisma_migrations" SET migration_name = '${newName}' WHERE migration_name = '${oldName}';`);
}

console.log('');
if (failed > 0) {
  console.error(`Migration validation FAILED (${failed} issue(s))`);
  process.exit(1);
}

console.log('Migration validation PASSED');
process.exit(0);
