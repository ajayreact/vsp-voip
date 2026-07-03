#!/usr/bin/env node
/**
 * One-time migration: promote V3 portal pages to root routes and remove V2 tenant portal pages.
 * Run from repo root: node scripts/remove-v2-portal-migrate.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'web', 'src', 'app', '(app)');
const V3 = path.join(APP, 'v3');

/** V2 tenant portal paths to remove (relative to APP). */
const V2_REMOVE = [
  'dashboard/page.tsx',
  'employees/page.tsx',
  'extensions/page.tsx',
  'phone-numbers/page.tsx',
  'devices/page.tsx',
  'ring-groups/page.tsx',
  'ring-groups/new/page.tsx',
  'ring-groups/[id]/page.tsx',
  'calls/page.tsx',
  'recordings/page.tsx',
  'voicemail/page.tsx',
  'sms/page.tsx',
  'assistant/page.tsx',
  'reports/page.tsx',
  'billing/page.tsx',
  'settings/page.tsx',
  'settings/profile/page.tsx',
  'settings/subscription/page.tsx',
  'settings/payment-methods/page.tsx',
  'settings/advanced/page.tsx',
  'settings/advanced/danger-zone/page.tsx',
  'settings/orders/[id]/page.tsx',
  'settings/team/page.tsx',
  'numbers/page.tsx',
  'cart/page.tsx',
  'cart/success/page.tsx',
  'cart/order-placed/page.tsx',
  'greeting/page.tsx',
  'my-numbers/page.tsx',
  'phone-system/page.tsx',
  'phone-system/extensions/page.tsx',
  'phone-system/extensions/new/page.tsx',
  'phone-system/extensions/[id]/page.tsx',
  'phone-system/devices/page.tsx',
  'phone-system/ring-groups/page.tsx',
  'phone-system/ring-groups/new/page.tsx',
  'phone-system/ring-groups/[id]/page.tsx',
  'phone-system/registration/page.tsx',
  'phone-system/security/page.tsx',
  'phone-system/call-routing/page.tsx',
  'phone-system/voicemail/page.tsx',
];

function rmrf(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      rmrf(path.join(filePath, entry));
    }
    fs.rmdirSync(filePath);
  } else {
    fs.unlinkSync(filePath);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  let content = fs.readFileSync(src, 'utf8');
  content = transformPageContent(content);
  fs.writeFileSync(dest, content, 'utf8');
}

function transformPageContent(content) {
  // Route paths: /v3/foo -> /foo (avoid touching /api/v3)
  content = content.replace(/(['"`])\/v3\//g, '$1/');
  content = content.replace(/href="\/v3\//g, 'href="/');
  content = content.replace(/href='\/v3\//g, "href='/");

  // Remove isV3PortalEnabled guard blocks
  content = content.replace(
    /\s*if\s*\(\s*!isV3PortalEnabled\(\)\s*\)\s*\{\s*router\.replace\(['"]\/dashboard['"]\);\s*return;\s*\}\s*\n?/g,
    '',
  );
  content = content.replace(
    /import\s*\{\s*([^}]*?),\s*isV3PortalEnabled\s*,?\s*([^}]*?)\}\s*from\s*'@\/lib\/v3-api';/g,
    (m, a, b) => {
      const parts = [a, b].join(',').split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from '@/lib/v3-api';`;
    },
  );
  content = content.replace(
    /import\s*\{\s*isV3PortalEnabled\s*,?\s*([^}]*?)\}\s*from\s*'@\/lib\/v3-api';/g,
    (m, rest) => {
      const parts = rest.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from '@/lib/v3-api';`;
    },
  );
  content = content.replace(
    /import\s*\{\s*isV3PortalEnabled\s*\}\s*from\s*'@\/lib\/v3-api';\s*\n?/g,
    '',
  );

  // Rename default export function names (cosmetic)
  content = content.replace(/V3(\w+)Page/g, '$1Page');

  return content;
}

function walkV3Pages(dir, base = '') {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...walkV3Pages(full, rel));
    } else if (entry.name === 'page.tsx') {
      pages.push({ rel: rel.replace(/\/page\.tsx$/, ''), src: full });
    }
  }
  return pages;
}

function main() {
  console.log('Removing V2 tenant portal pages...');
  for (const rel of V2_REMOVE) {
    const p = path.join(APP, rel);
    rmrf(p);
    console.log('  removed', rel);
  }

  // Clean empty dirs
  for (const dir of ['cart', 'phone-system', 'settings', 'ring-groups', 'my-numbers', 'greeting']) {
    const p = path.join(APP, dir);
    if (fs.existsSync(p)) {
      try {
        const entries = fs.readdirSync(p);
        if (entries.length === 0) fs.rmdirSync(p);
      } catch {
        /* non-empty — ok */
      }
    }
  }

  console.log('Promoting V3 pages to root routes...');
  const v3Pages = walkV3Pages(V3);
  const migrated = [];
  for (const { rel, src } of v3Pages) {
    const dest = path.join(APP, rel, 'page.tsx');
    copyFile(src, dest);
    migrated.push({ from: `/v3/${rel}`, to: `/${rel}` });
    console.log('  migrated', rel);
  }

  console.log('Removing v3/ directory...');
  rmrf(V3);

  const report = {
    migratedRoutes: migrated,
    removedV2Paths: V2_REMOVE.map((r) => '/' + r.replace(/\/page\.tsx$/, '')),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(ROOT, 'V2_PORTAL_REMOVAL_MIGRATION.json'),
    JSON.stringify(report, null, 2),
  );
  console.log('Done. Report: V2_PORTAL_REMOVAL_MIGRATION.json');
}

main();
