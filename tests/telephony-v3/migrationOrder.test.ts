import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = resolve(__dirname, '../../prisma/migrations');

const V3_CHAIN = [
  '20260624180500_v3_telephony_phase1',
  '20260624181000_v3_telephony_phase1_5_hardening',
  '20260627120000_v3_phase395_hardening',
];

describe('Prisma migration ordering', () => {
  it('exposes V3 migrations in dependency order', () => {
    for (const dir of V3_CHAIN) {
      expect(existsSync(resolve(MIGRATIONS, dir, 'migration.sql'))).toBe(true);
    }

    const sorted = [...V3_CHAIN].sort();
    expect(sorted).toEqual(V3_CHAIN);
  });

  it('passes validate-prisma-migrations.js', () => {
    execSync('node scripts/validate-prisma-migrations.js', {
      cwd: resolve(__dirname, '../..'),
      stdio: 'pipe',
      encoding: 'utf8',
    });
  });
});
