import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneHealthService = require('../../lib/v3/softphoneHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneProfileService = require('../../lib/v3/softphoneProfileService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const devicePreferenceService = require('../../lib/v3/devicePreferenceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const presenceService = require('../../lib/v3/presenceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const contactDirectoryService = require('../../lib/v3/contactDirectoryService.js');

describe('V3 softphoneHealthService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('aggregates softphone UX health for tenant', async () => {
    const prisma = {
      user: {
        findMany: vi.fn(async () => [{ id: 'u1', name: 'Alice', email: 'a@x.com' }]),
      },
    };

    vi.spyOn(softphoneProfileService, 'getProfileReadOnly').mockResolvedValue({
      preferredCallerId: '+1', preferredDevice: 'desktop', timezone: 'UTC', language: 'en',
    });
    vi.spyOn(softphoneProfileService, 'isProfileComplete').mockReturnValue(true);
    vi.spyOn(devicePreferenceService, 'listDevicePreferences').mockResolvedValue({
      items: [{ preferred: true, deviceType: 'desktop' }], total: 1,
    });
    vi.spyOn(presenceService, 'getPresence').mockResolvedValue({ status: 'available' });
    vi.spyOn(contactDirectoryService, 'directorySyncHealth').mockResolvedValue({
      userCount: 1, extensionCount: 1, linkedCount: 1, synced: true,
    });

    const health = await softphoneHealthService.softphoneUxHealth(prisma, 't1');
    expect(health.users).toHaveLength(1);
    expect(health.summary.total).toBe(1);
    expect(health.directory.synced).toBe(true);
  });
});
