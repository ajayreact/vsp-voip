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

  it('callingController uses client.newCall for extensions', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/calling/callingController.ts'),
      'utf8',
    );
    expect(source).not.toContain('postInternalExtensionCall');
    expect(source).not.toContain('placeInternalExtensionCall');
    expect(source).toContain('client.newCall(dialTarget');
    expect(source).toContain('isExtensionDialInput');
  });

  it('softphoneService exposes postInternalExtensionCall', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'mobile-rn/src/calling/softphoneService.ts'),
      'utf8',
    );
    expect(source).toContain('endpoints.softphone.internalCall');
  });
});
