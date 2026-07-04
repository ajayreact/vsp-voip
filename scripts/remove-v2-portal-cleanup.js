#!/usr/bin/env node
/** Clean up leftover V2 portal dirs and isV3PortalEnabled guards. */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'web', 'src', 'app', '(app)');

const V2_DIRS = [
  'assistant', 'calls', 'cart', 'extensions', 'phone-numbers', 'phone-system',
  'recordings', 'settings', 'sms', 'ring-groups/new', 'ring-groups/[id]',
  'my-numbers', 'greeting',
];

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) cb(full);
  }
}

for (const rel of V2_DIRS) rmrf(path.join(APP, rel));

// Remove empty ring-groups subdirs if V3 ring-groups page exists at root
for (const sub of ['new', '[id]']) {
  const p = path.join(APP, 'ring-groups', sub);
  if (fs.existsSync(p)) rmrf(p);
}

walk(path.join(__dirname, '..', 'web', 'src', 'app', '(app)'), (file) => {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  c = c.replace(/\s*if\s*\(\s*!isV3PortalEnabled\(\)\s*\)\s*(?:router\.replace\(['"]\/dashboard['"]\)|{\s*router\.replace\(['"]\/dashboard['"]\);\s*return;\s*})\s*;?\s*\n?/g, '');
  c = c.replace(/\s*if\s*\(\s*!isV3PortalEnabled\(\)\s*\)\s*{\s*router\.replace\(['"]\/dashboard['"]\);\s*return;\s*}\s*\n?/g, '');
  c = c.replace(/,\s*isV3PortalEnabled/g, '');
  c = c.replace(/isV3PortalEnabled,\s*/g, '');
  c = c.replace(/import\s*\{\s*isV3PortalEnabled\s*\}\s*from\s*'@\/lib\/v3-api';\s*\n?/g, '');
  if (c !== orig) {
    fs.writeFileSync(file, c);
    console.log('fixed', path.relative(APP, file));
  }
});

console.log('cleanup done');
