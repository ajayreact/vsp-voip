import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isExtensionDialInput } from '../../mobile-rn/src/calling/dialNormalization';

describe('mobile / internal extension dial', () => {
  it('detects extension dial input (2–6 digits)', () => {
    expect(isExtensionDialInput('101')).toBe(true);
    expect(isExtensionDialInput('102')).toBe(true);
    expect(isExtensionDialInput('+13135551212')).toBe(false);
    expect(isExtensionDialInput('3135551212')).toBe(false);
  });

  it('callingController uses internal-call API for extensions', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/calling/callingController.ts'),
      'utf8',
    );
    expect(source).toContain('postInternalExtensionCall');
    expect(source).not.toMatch(/newCall\(\s*extensionDigits/);
    expect(source).toContain('placeInternalExtensionCall');
  });

  it('softphoneService exposes postInternalExtensionCall', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/calling/softphoneService.ts'),
      'utf8',
    );
    expect(source).toContain('endpoints.softphone.internalCall');
  });
});
