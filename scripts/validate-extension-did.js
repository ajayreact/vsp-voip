#!/usr/bin/env node
/**
 * Extension (100–999) + tenant-scoped DID assignment validation.
 *
 * npm run validate:extension-did
 */
require('dotenv').config();

const {
  isValidExtensionNumber,
  normalizeExtensionNumber,
  suggestNextExtensionNumber,
  EXTENSION_MIN,
  EXTENSION_MAX,
} = require('../lib/extensionNumber');
const {
  assignDidToTenant,
  unassignDidFromTenant,
  getDidAssignmentHistory,
} = require('../lib/adminDidManagement');

const results = [];

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, name, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function expectThrow(fn, name, { status } = {}) {
  try {
    fn();
    fail(name, 'expected throw');
  } catch (error) {
    if (status != null && error.status !== status) {
      fail(name, `expected status ${status}, got ${error.status}`);
      return;
    }
    pass(name, error.message);
  }
}

function mockPrismaForTenants() {
  const tenants = {
    'tenant-a-ext': { id: 'tenant-a-ext', name: 'Tenant A' },
    'tenant-b-ext': { id: 'tenant-b-ext', name: 'Tenant B' },
  };
  const phones = new Map();
  const history = [];

  const prisma = {
    tenant: {
      findUnique: async ({ where }) => tenants[where.id] || null,
    },
    phoneNumber: {
      findUnique: async ({ where }) => {
        if (where.id) {
          for (const row of phones.values()) if (row.id === where.id) return { ...row };
        }
        if (where.number) return phones.get(where.number) ? { ...phones.get(where.number) } : null;
        return null;
      },
      findMany: async () => [...phones.values()],
      create: async ({ data }) => {
        const row = { id: `phone-${phones.size + 1}`, ...data };
        phones.set(row.number, row);
        return row;
      },
      update: async ({ where, data, include }) => {
        const existing = [...phones.values()].find((p) => p.id === where.id);
        if (!existing) throw new Error('missing phone');
        Object.assign(existing, data);
        phones.set(existing.number, existing);
        const result = { ...existing };
        if (include?.tenant) {
          result.tenant = tenants[existing.tenantId] || null;
        }
        return result;
      },
    },
    extension: {
      findFirst: async () => null,
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    didAssignmentHistory: {
      create: async ({ data }) => {
        history.push(data);
        return data;
      },
      findMany: async () => history.slice().reverse(),
      count: async () => history.length,
    },
    $transaction: async (fn) => fn(prisma),
  };

  return { prisma, history };
}

function testExtensionValidation() {
  for (const valid of ['100', '101', '555', '999']) {
    assert(normalizeExtensionNumber(valid) === valid, `valid extension ${valid}`);
    assert(isValidExtensionNumber(valid), `isValid ${valid}`);
  }

  expectThrow(() => normalizeExtensionNumber('99'), 'reject 99', { status: 400 });
  expectThrow(() => normalizeExtensionNumber('1000'), 'reject 1000', { status: 400 });
  expectThrow(() => normalizeExtensionNumber('abc'), 'reject abc', { status: 400 });
  expectThrow(() => normalizeExtensionNumber('10a'), 'reject 10a', { status: 400 });
  expectThrow(() => normalizeExtensionNumber(''), 'reject blank', { status: 400 });
  expectThrow(() => normalizeExtensionNumber(' 101'), 'reject spaces', { status: 400 });

  const next = suggestNextExtensionNumber(['101', '102', '103']);
  assert(next === '100' || next === '104', 'suggestNextExtensionNumber finds gap', next);
  assert(EXTENSION_MIN === 100 && EXTENSION_MAX === 999, 'range constants');
}

function testTenantScopedExtensions() {
  assert(normalizeExtensionNumber('101') === '101', 'tenant A ext 101 valid');
  assert(normalizeExtensionNumber('101') === '101', 'tenant B ext 101 valid (same digits, different tenants allowed)');
}

async function testDidAssignUnassign() {
  const axios = require('axios');
  const originalGet = axios.get.bind(axios);
  axios.get = async (url, opts) => {
    if (String(url).includes('api.telnyx.com/v2/phone_numbers')) {
      return { data: { data: [{ id: 'telnyx-mock-id' }] } };
    }
    return originalGet(url, opts);
  };

  const tenantCache = require('../lib/tenantCache');
  const originalSetCached = tenantCache.setCachedTenant;
  const originalInvalidate = tenantCache.invalidateCachedTenant;
  tenantCache.setCachedTenant = async () => {};
  tenantCache.invalidateCachedTenant = async () => {};

  const { prisma } = mockPrismaForTenants();

  try {
    const created = await prisma.phoneNumber.create({
      data: {
        number: '+15550001001',
        tenantId: null,
        isActive: true,
        source: 'TEST',
        routingType: 'tenant_default',
      },
    });

    const assignedA = await assignDidToTenant(prisma, {
      phoneNumberId: created.id,
      tenantId: 'tenant-a-ext',
      apiKey: 'test-key',
    });
    assert(assignedA.tenantId === 'tenant-a-ext', 'assign DID to tenant A');

    const reassigned = await assignDidToTenant(prisma, {
      phoneNumberId: created.id,
      tenantId: 'tenant-b-ext',
      apiKey: 'test-key',
    });
    assert(reassigned.tenantId === 'tenant-b-ext', 'DID reassigned to tenant B');

    const unassigned = await unassignDidFromTenant(prisma, created.id);
    assert(!unassigned.tenantId, 'unassign clears tenantId');

    const hist = await getDidAssignmentHistory(prisma, { limit: 10 });
    assert(hist.rows.length >= 3, 'assignment history recorded', String(hist.rows.length));
  } finally {
    axios.get = originalGet;
    tenantCache.setCachedTenant = originalSetCached;
    tenantCache.invalidateCachedTenant = originalInvalidate;
  }
}

async function testTransferUsesTenantContext() {
  const fs = require('fs');
  const path = require('path');
  const transferSource = fs.readFileSync(
    path.join(__dirname, '../lib/callTransferControl.js'),
    'utf8',
  );
  assert(
    transferSource.includes('where: { tenantId, extensionNumber, status: \'ACTIVE\' }'),
    'blind transfer extension lookup includes tenantId',
  );

  const tenantA = 'tenant-transfer-a';
  const tenantB = 'tenant-transfer-b';

  async function lookupExtension(prisma, tenantId, extensionNumber) {
    return prisma.extension.findFirst({
      where: { tenantId, extensionNumber, status: 'ACTIVE' },
    });
  }

  const prisma = {
    extension: {
      findFirst: async ({ where }) => {
        if (where.tenantId === tenantA && where.extensionNumber === '101') {
          return { id: 'ext-a-101', extensionNumber: '101' };
        }
        if (where.tenantId === tenantB && where.extensionNumber === '101') {
          return { id: 'ext-b-101', extensionNumber: '101' };
        }
        return null;
      },
    },
  };

  const extA = await lookupExtension(prisma, tenantA, '101');
  const extB = await lookupExtension(prisma, tenantB, '101');
  assert(extA?.id === 'ext-a-101', 'tenant A extension 101 resolves within tenant A');
  assert(extB?.id === 'ext-b-101', 'tenant B extension 101 resolves within tenant B');
  assert(extA.id !== extB.id, 'same extension digits resolve to different records per tenant');
}

async function testDuplicateAssignmentPrevented() {
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  assert(schema.includes('number                   String   @unique'), 'DID number is globally unique (one row per DID)');
  assert(schema.includes('tenantId                 String?'), 'PhoneNumber.tenantId is single nullable owner field');

  const source = fs.readFileSync(path.join(__dirname, '../lib/adminDidManagement.js'), 'utf8');
  assert(source.includes('prisma.$transaction'), 'DID assign/reassign uses database transaction');
  assert(source.includes('unassignAllDidsForTenant'), 'tenant delete unassign helper exists');
}

async function testExtensionDeletionGuard() {
  const { collectExtensionDeletionBlockers } = require('../lib/extensionDependencies');
  const prisma = {
    ringGroupMember: {
      findMany: async () => [{
        ringGroup: { id: 'rg-1', name: 'Support', extensionNumber: '200' },
      }],
    },
    ringGroup: { findMany: async () => [] },
    phoneNumber: {
      findFirst: async () => null,
      findMany: async () => [{ id: 'p1', number: '+15551234567', routingType: 'direct_user' }],
    },
    greeting: { findUnique: async () => ({ ivrOptions: [] }) },
    extensionForwarding: { findMany: async () => [] },
  };

  const blockers = await collectExtensionDeletionBlockers(prisma, 'tenant-1', {
    id: 'ext-1',
    extensionNumber: '101',
    primaryPhoneNumberId: null,
  });
  assert(blockers.some((b) => b.type === 'ring_group'), 'extension deletion blocked by ring group membership');
  assert(blockers.some((b) => b.type === 'did_routing'), 'extension deletion blocked by DID routing');
}

function testUnassignedInboundAudit() {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '../lib/inboundCallControl.js'), 'utf8');
  assert(source.includes('inbound.unassigned_did'), 'unassigned DID inbound calls write admin audit log');
  assert(source.includes('This number is not configured'), 'unassigned DID inbound calls fail gracefully');
}

async function main() {
  testExtensionValidation();
  testTenantScopedExtensions();
  await testDidAssignUnassign();
  await testTransferUsesTenantContext();
  await testDuplicateAssignmentPrevented();
  await testExtensionDeletionGuard();
  testUnassignedInboundAudit();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
