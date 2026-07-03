#!/usr/bin/env node
/**
 * Manual telephony reconciliation tool — STANDALONE MAINTENANCE ONLY.
 *
 * This script is completely independent of runtime call routing. It is never
 * imported by the API, worker, Call Control, deskRouter, webhooks, or SIP
 * paths. It only reads the database, reports link inconsistencies for a single
 * tenant, and (with --apply) repairs *missing or inconsistent links*.
 *
 * Guarantees:
 *   - Dry-run by default. Writes ONLY with --apply.
 *   - Never deletes data.
 *   - Never recreates a Telnyx credential that already exists (only provisions
 *     when User.telnyxCredentialId / telnyxSipUsername are MISSING).
 *   - Never fabricates live state (sipRegistered is reported, never written).
 *   - Never invents ownership (a null Extension.userId is reported, not guessed).
 *   - Idempotent: re-running after --apply reports zero changes.
 *
 * Usage:
 *   node scripts/reconcile-tenant-telephony.js --tenant "Asuitech"
 *   node scripts/reconcile-tenant-telephony.js --tenant "Asuitech" --apply
 *   node scripts/reconcile-tenant-telephony.js --tenant-id <uuid> --json
 *
 * Flags:
 *   --tenant <name>    Tenant name (case-insensitive; falls back to contains).
 *   --tenant-id <uuid> Tenant id (exact).
 *   --apply            Perform writes. Omit for dry-run.
 *   --json             Machine-readable output.
 */

require('dotenv').config();

function parseArgs(argv) {
  const args = { tenant: null, tenantId: null, apply: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--json') args.json = true;
    else if (a === '--tenant') { args.tenant = argv[i + 1] || null; i += 1; }
    else if (a === '--tenant-id') { args.tenantId = argv[i + 1] || null; i += 1; }
  }
  return args;
}

function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run this on a host with database access.');
  }
  const { PrismaClient } = require('../generated/prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

async function resolveTenant(prisma, { tenant, tenantId }) {
  if (tenantId) {
    const row = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!row) throw new Error(`Tenant id not found: ${tenantId}`);
    return row;
  }
  if (!tenant) throw new Error('Provide --tenant <name> or --tenant-id <uuid>.');

  const exact = await prisma.tenant.findFirst({
    where: { name: { equals: tenant, mode: 'insensitive' } },
  });
  if (exact) return exact;

  const matches = await prisma.tenant.findMany({
    where: { name: { contains: tenant, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (matches.length === 1) {
    return prisma.tenant.findUnique({ where: { id: matches[0].id } });
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous tenant "${tenant}": ${matches.map((m) => m.name).join(', ')}. Use --tenant-id.`);
  }
  throw new Error(`Tenant not found: ${tenant}`);
}

/**
 * A single planned change. `write` performs the mutation (only called on --apply).
 */
function change({ entity, id, ref, field, from, to, reason, write }) {
  return { entity, id, ref, field, from, to, reason, write };
}

function fmt(v) {
  if (v === null || v === undefined) return 'MISSING';
  return String(v);
}

async function analyze(prisma, tenant, credentialConnectionId) {
  const tenantId = tenant.id;

  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: { user: true, security: true, primaryPhoneNumber: true },
    orderBy: { extensionNumber: 'asc' },
  });
  const phoneNumbers = await prisma.phoneNumber.findMany({ where: { tenantId } });
  const users = await prisma.user.findMany({ where: { tenantId } });

  const phoneById = new Map(phoneNumbers.map((p) => [p.id, p]));
  const phonesByExtensionId = new Map();
  for (const p of phoneNumbers) {
    if (p.extensionId) {
      if (!phonesByExtensionId.has(p.extensionId)) phonesByExtensionId.set(p.extensionId, []);
      phonesByExtensionId.get(p.extensionId).push(p);
    }
  }

  const changes = [];
  const observations = [];
  const usersNeedingCredentials = new Map(); // userId -> user

  for (const ext of extensions) {
    const linkedPhones = phonesByExtensionId.get(ext.id) || [];
    const primary = ext.primaryPhoneNumberId ? phoneById.get(ext.primaryPhoneNumberId) : null;

    // --- Extension.userId (report only; never invent ownership) ---
    if (!ext.userId) {
      observations.push(`Extension ${ext.extensionNumber}: no employee assigned (userId MISSING) — legacy/desk-only or awaiting assignment.`);
    }

    // --- primaryPhoneNumberId <-> PhoneNumber.extensionId consistency ---
    if (ext.primaryPhoneNumberId && !primary) {
      observations.push(`Extension ${ext.extensionNumber}: primaryPhoneNumberId ${ext.primaryPhoneNumberId} points to a missing PhoneNumber (not repaired — no data to invent).`);
    }
    if (primary && primary.extensionId !== ext.id) {
      if (!primary.extensionId) {
        changes.push(change({
          entity: 'PhoneNumber', id: primary.id, ref: primary.number,
          field: 'extensionId', from: primary.extensionId, to: ext.id,
          reason: `primary DID of extension ${ext.extensionNumber} was not back-linked`,
          write: () => prisma.phoneNumber.update({ where: { id: primary.id }, data: { extensionId: ext.id } }),
        }));
      } else {
        observations.push(`Extension ${ext.extensionNumber}: primary DID ${primary.number} is linked to a different extension (${primary.extensionId}); not auto-stolen (non-destructive).`);
      }
    }
    if (!ext.primaryPhoneNumberId && linkedPhones.length === 1) {
      const only = linkedPhones[0];
      changes.push(change({
        entity: 'Extension', id: ext.id, ref: ext.extensionNumber,
        field: 'primaryPhoneNumberId', from: null, to: only.id,
        reason: `exactly one DID (${only.number}) links to this extension but primaryPhoneNumberId was null`,
        write: () => prisma.extension.update({ where: { id: ext.id }, data: { primaryPhoneNumberId: only.id } }),
      }));
    } else if (!ext.primaryPhoneNumberId && linkedPhones.length > 1) {
      observations.push(`Extension ${ext.extensionNumber}: ${linkedPhones.length} DIDs link here but primaryPhoneNumberId is null — ambiguous, not auto-set.`);
    }

    // --- PhoneNumber.assignedUserId aligned to Extension.userId ---
    if (ext.userId) {
      const candidates = new Set(linkedPhones.map((p) => p.id));
      if (primary) candidates.add(primary.id);
      for (const phoneId of candidates) {
        const phone = phoneById.get(phoneId);
        if (!phone) continue;
        if (phone.assignedUserId !== ext.userId) {
          changes.push(change({
            entity: 'PhoneNumber', id: phone.id, ref: phone.number,
            field: 'assignedUserId', from: phone.assignedUserId, to: ext.userId,
            reason: `DID linked to extension ${ext.extensionNumber} but assignedUserId != Extension.userId`,
            write: () => prisma.phoneNumber.update({ where: { id: phone.id }, data: { assignedUserId: ext.userId } }),
          }));
        }
      }
    }

    // --- User telephony credential (provision only when MISSING) ---
    if (ext.userId) {
      const user = ext.user || users.find((u) => u.id === ext.userId);
      if (user && (!user.telnyxCredentialId || !user.telnyxSipUsername)) {
        usersNeedingCredentials.set(user.id, user);
      }
      // sipRegistered is LIVE state — report only, never written.
      if (user && ext.status === 'ACTIVE' && user.sipRegistered !== true) {
        observations.push(`Extension ${ext.extensionNumber}: User.sipRegistered=${fmt(user?.sipRegistered)} (live state — not modified; the device must register).`);
      }
    }

    // --- Extension.telnyxSipUsername (legacy) — report only ---
    if (ext.userId && ext.user?.telnyxSipUsername && ext.telnyxSipUsername
        && ext.telnyxSipUsername !== ext.user.telnyxSipUsername) {
      observations.push(`Extension ${ext.extensionNumber}: legacy Extension.telnyxSipUsername (${ext.telnyxSipUsername}) differs from User.telnyxSipUsername (${ext.user.telnyxSipUsername}) — reported only; canonical identity is the User credential.`);
    }
  }

  // Credential provisioning changes (each is a single change entry).
  for (const user of usersNeedingCredentials.values()) {
    changes.push(change({
      entity: 'User', id: user.id, ref: user.email || user.name,
      field: 'telnyxCredentialId/telnyxSipUsername',
      from: `${fmt(user.telnyxCredentialId)} / ${fmt(user.telnyxSipUsername)}`,
      to: '(provision on Credential Connection)',
      reason: 'assigned to an extension but Telnyx credential/SIP username missing',
      write: async () => {
        if (!credentialConnectionId) throw new Error('Credential Connection ID not configured (platform settings)');
        const { getOrCreateUserTelephonyCredential } = require('../lib/softphone');
        return getOrCreateUserTelephonyCredential({
          prisma, userId: user.id, tenantId, connectionId: credentialConnectionId,
        });
      },
    }));
  }

  return { extensions, phoneNumbers, users, changes, observations };
}

function renderText(tenant, result, apply, credentialConnectionId, applied) {
  const lines = [];
  lines.push('\nTENANT TELEPHONY RECONCILIATION');
  lines.push(`Tenant: ${tenant.name} (${tenant.id})`);
  lines.push(`Mode:   ${apply ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  lines.push(`Credential Connection ID: ${credentialConnectionId || 'MISSING'}`);
  lines.push(`Scanned: ${result.extensions.length} extension(s), ${result.users.length} user(s), ${result.phoneNumbers.length} phone number(s).`);
  lines.push('-'.repeat(72));

  if (!result.changes.length) {
    lines.push('CONSISTENT: no missing or inconsistent links found.');
  } else {
    lines.push(`${result.changes.length} change(s) ${apply ? 'applied' : 'proposed'}:`);
    result.changes.forEach((c, i) => {
      const status = apply ? (applied[i]?.ok ? '[APPLIED]' : `[FAILED: ${applied[i]?.error}]`) : '[DRY-RUN]';
      lines.push(`  ${status} ${c.entity} ${c.ref} — ${c.field}`);
      lines.push(`      ${fmt(c.from)}  ->  ${fmt(c.to)}`);
      lines.push(`      reason: ${c.reason}`);
    });
  }

  if (result.observations.length) {
    lines.push('-'.repeat(72));
    lines.push('Observations (reported, not modified):');
    for (const o of result.observations) lines.push(`  - ${o}`);
  }

  lines.push('-'.repeat(72));
  if (!apply && result.changes.length) {
    lines.push('Re-run with --apply to perform these writes.');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let prisma;
  try {
    prisma = getPrisma();
  } catch (error) {
    console.error(String(error.message || error).split('\n')[0]);
    process.exit(1);
  }

  try {
    const tenant = await resolveTenant(prisma, args);

    let credentialConnectionId = '';
    try {
      const { loadPlatformSettings } = require('../lib/platformSettings');
      const { getCredentialConnectionId } = require('../lib/telnyxConfig');
      credentialConnectionId = getCredentialConnectionId(await loadPlatformSettings(prisma)) || '';
    } catch { /* reported as MISSING */ }

    const result = await analyze(prisma, tenant, credentialConnectionId);

    const applied = [];
    if (args.apply) {
      for (const c of result.changes) {
        try {
          await c.write();
          applied.push({ ok: true });
        } catch (error) {
          applied.push({ ok: false, error: error.message });
        }
      }
    }

    if (args.json) {
      console.log(JSON.stringify({
        tenant: { id: tenant.id, name: tenant.name },
        mode: args.apply ? 'apply' : 'dry-run',
        credentialConnectionId: credentialConnectionId || null,
        scanned: {
          extensions: result.extensions.length,
          users: result.users.length,
          phoneNumbers: result.phoneNumbers.length,
        },
        changes: result.changes.map((c, i) => ({
          entity: c.entity, ref: c.ref, id: c.id, field: c.field,
          from: c.from, to: c.to, reason: c.reason,
          applied: args.apply ? applied[i] : null,
        })),
        observations: result.observations,
      }, null, 2));
    } else {
      console.log(renderText(tenant, result, args.apply, credentialConnectionId, applied));
    }
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs, analyze };
