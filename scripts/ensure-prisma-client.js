const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const clientPath = path.join(root, 'generated', 'prisma', 'client.ts');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');

if (fs.existsSync(clientPath)) {
  process.exit(0);
}

if (!fs.existsSync(schemaPath)) {
  process.exit(0);
}

if (!fs.existsSync(path.join(root, 'node_modules', 'prisma'))) {
  console.warn('[postinstall] Skipping prisma generate (prisma CLI not installed).');
  process.exit(0);
}

execSync('npx prisma generate', { stdio: 'inherit', cwd: root });
