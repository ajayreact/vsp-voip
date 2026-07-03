#!/usr/bin/env node
/** Final cleanup: remove V2 portal artifacts and fix /v3/ path references. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'web', 'src', 'app', '(app)');
const WEB_SRC = path.join(ROOT, 'web', 'src');

const V2_DIRS = [
  'v3', 'assistant', 'calls', 'cart', 'extensions', 'phone-numbers', 'phone-system',
  'recordings', 'settings', 'sms', 'my-numbers', 'greeting',
];

const PORTAL_REMOVE = [
  'extensions-manager', 'devices-manager', 'phone-numbers-manager', 'ring-groups-manager',
  'ring-group-create', 'ring-group-detail', 'calls-manager', 'recordings-manager',
  'voicemail-manager', 'billing-manager', 'settings-hub', 'assistant-page',
  'reset-pbx-configuration-panel',
];

const EXTENSION_COMPONENTS = [
  'extension-detail-drawer.tsx', 'extension-detail-drawer-shell.tsx', 'extension-form-panel.tsx',
  'extension-business-panel.tsx', 'extension-ownership-panel.tsx', 'extension-security-panel.tsx',
  'extension-sip-panel.tsx', 'extension-qr-panel.tsx', 'extension-analytics-panel.tsx',
  'extension-primary-did-select.tsx',
];

const OTHER_REMOVE = [
  path.join(WEB_SRC, 'context', 'cart-context.tsx'),
  path.join(WEB_SRC, 'lib', 'portal-dashboard.ts'),
  path.join(WEB_SRC, 'components', 'phone-system-nav.tsx'),
];

function rmrf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log('removed', path.relative(ROOT, p));
  }
}

for (const rel of V2_DIRS) rmrf(path.join(APP, rel));
for (const f of PORTAL_REMOVE) rmrf(path.join(WEB_SRC, 'components', 'portal', `${f}.tsx`));
for (const f of EXTENSION_COMPONENTS) rmrf(path.join(WEB_SRC, 'components', f));
for (const f of OTHER_REMOVE) rmrf(f);

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) cb(full);
  }
}

walk(WEB_SRC, (file) => {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  // UI routes only — preserve /api/v3
  c = c.replace(/(['"`])\/v3\//g, '$1/');
  c = c.replace(/href="\/v3\//g, 'href="/');
  c = c.replace(/href='\/v3\//g, "href='/");
  c = c.replace(/\s*if\s*\(\s*!isV3PortalEnabled\(\)\s*\)\s*(?:router\.(?:replace|push)\([^)]+\)|{\s*router\.(?:replace|push)\([^)]+\);\s*return;\s*})\s*;?\s*\n?/g, '');
  c = c.replace(/,\s*isV3PortalEnabled/g, '');
  c = c.replace(/isV3PortalEnabled,\s*/g, '');
  c = c.replace(/import\s*\{\s*isV3PortalEnabled\s*\}\s*from\s*'@\/lib\/v3-api';\s*\n?/g, '');
  if (c !== orig) {
    fs.writeFileSync(file, c);
    console.log('fixed', path.relative(ROOT, file));
  }
});

console.log('final cleanup done');
