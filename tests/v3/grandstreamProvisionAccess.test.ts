import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildGrandstreamConfigServerPath,
  buildGrandstreamProvisionFilename,
  buildGrandstreamProvisionUrl,
  isProvisionAccessAllowed,
  isDeviceProvisionable,
  normalizeMacForFilename,
} = require('../../lib/v3/grandstreamPvalueConfig.js');

describe('grandstream provision access', () => {
  it('allows MAC-only fetch without query key (Grandstream phone)', () => {
    expect(isProvisionAccessAllowed({ provisionKey: 'secret-key' }, undefined)).toBe(true);
    expect(isProvisionAccessAllowed({ provisionKey: 'secret-key' }, '')).toBe(true);
  });

  it('validates optional query key when provided for manual download', () => {
    expect(isProvisionAccessAllowed({ provisionKey: 'secret-key' }, 'secret-key')).toBe(true);
    expect(isProvisionAccessAllowed({ provisionKey: 'secret-key' }, 'wrong-key')).toBe(false);
    expect(isProvisionAccessAllowed({}, 'any-key')).toBe(true);
  });

  it('parses MAC from standard Grandstream filename', () => {
    expect(buildGrandstreamProvisionFilename('EC74D751E3E7')).toBe('cfgec74d751e3e7.xml');
    expect(normalizeMacForFilename('ec:74:d7:51:e3:e7')).toBe('ec74d751e3e7');
  });

  it('exposes config server base path without query key', () => {
    process.env.API_PUBLIC_URL = 'https://api.vspphone.com';
    expect(buildGrandstreamConfigServerPath()).toBe('https://api.vspphone.com/provision/');
    expect(buildProvisionUrlGrandstream()).toBe('https://api.vspphone.com/provision/');
  });

  it('builds optional manual download URL with key', () => {
    process.env.API_PUBLIC_URL = 'https://api.vspphone.com';
    const url = buildGrandstreamProvisionUrl('EC74D751E3E7', 'abc123');
    expect(url).toBe('https://api.vspphone.com/provision/cfgec74d751e3e7.xml?key=abc123');
  });

  it('accepts assigned or provisioned devices', () => {
    expect(isDeviceProvisionable({
      status: 'PROVISIONED',
      extensionId: 'e1',
    })).toBe(true);
    expect(isDeviceProvisionable({
      status: 'ASSIGNED',
      extensionId: 'e1',
    })).toBe(true);
    expect(isDeviceProvisionable({
      status: 'CREATED',
      extensionId: null,
    })).toBe(false);
    expect(isDeviceProvisionable({
      status: 'REMOVED',
      extensionId: 'e1',
    })).toBe(false);
  });
});

function buildProvisionUrlGrandstream() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deviceTemplateService = require('../../lib/v3/deviceTemplateService.js');
  return deviceTemplateService.buildProvisionUrl({ vendor: 'grandstream' }, 'grandstream');
}
