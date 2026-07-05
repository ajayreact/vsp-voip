import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRE_CONNECT_MEDIA_POLICY,
  isExtensionManagedInbound,
  resolvePreConnectMediaPolicy,
  policyRequiresPstnAnswer,
  policyPlaysGreeting,
  policyPlaysRecordingNotice,
} from '../../lib/preConnectMediaPolicy.js';

const inboundSource = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');

const tenantGreetingOn = {
  playGreetingBeforeConnect: true,
  playCallRecordingNotice: true,
  callRecordingEnabled: true,
};

describe('preConnectMediaPolicy / 1. Extension DIDs always NONE', () => {
  it('extensionId on phone record is always NONE', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { extensionId: 'ext-101', routingType: 'direct_user' },
      greeting: tenantGreetingOn,
      routedExtension: { id: 'ext-101', extensionNumber: '101' },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.NONE);
  });

  it('direct_user with resolved extension is always NONE', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'direct_user', assignedUserId: 'user-1' },
      greeting: tenantGreetingOn,
      routedExtension: { id: 'ext-100', extensionNumber: '100' },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.NONE);
  });

  it('extension DID wins over tenant IVR flags', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { extensionId: 'ext-1', routingType: 'tenant_default' },
      greeting: { ...tenantGreetingOn, ivrEnabled: true },
      routedExtension: { id: 'ext-1' },
      ivrWouldRun: false,
    })).toBe(PRE_CONNECT_MEDIA_POLICY.NONE);
  });
});

describe('preConnectMediaPolicy / 2. Main company DID from tenant greeting', () => {
  it('tenant_default with both flags -> GREETING_AND_RECORDING', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: tenantGreetingOn,
    })).toBe(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING);
  });

  it('tenant_default greeting only -> GREETING', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: {
        playGreetingBeforeConnect: true,
        playCallRecordingNotice: false,
        callRecordingEnabled: true,
      },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.GREETING);
  });

  it('tenant_default recording only -> RECORDING_NOTICE', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: {
        playGreetingBeforeConnect: false,
        playCallRecordingNotice: true,
        callRecordingEnabled: true,
      },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.RECORDING_NOTICE);
  });

  it('tenant_default announcements disabled -> NONE', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: {
        playGreetingBeforeConnect: false,
        playCallRecordingNotice: false,
        callRecordingEnabled: true,
      },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.NONE);
  });
});

describe('preConnectMediaPolicy / 3. IVR and Auto Attendant', () => {
  it('ivrWouldRun resolves to IVR', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: tenantGreetingOn,
      ivrWouldRun: true,
    })).toBe(PRE_CONNECT_MEDIA_POLICY.IVR);
  });

  it('phone routingType ivr resolves to IVR', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'ivr' },
      greeting: { ivrEnabled: true },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.IVR);
  });

  it('tenant_default with greeting ivrEnabled resolves to IVR', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'tenant_default' },
      greeting: { ...tenantGreetingOn, ivrEnabled: true },
    })).toBe(PRE_CONNECT_MEDIA_POLICY.IVR);
  });
});

describe('preConnectMediaPolicy / ring groups and forwards use tenant media', () => {
  it('ring_group DID is not extension-managed and keeps tenant greeting', () => {
    expect(isExtensionManagedInbound({ routingType: 'ring_group', ringGroupId: 'rg-1' })).toBe(false);
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'ring_group', ringGroupId: 'rg-1' },
      greeting: tenantGreetingOn,
    })).toBe(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING);
  });

  it('forward DID keeps tenant greeting policy', () => {
    expect(resolvePreConnectMediaPolicy({
      phoneRecord: { routingType: 'forward', forwardDestination: '+15551234567' },
      greeting: tenantGreetingOn,
    })).toBe(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING);
  });
});

describe('preConnectMediaPolicy / helpers', () => {
  it('NONE does not require PSTN answer for media', () => {
    expect(policyRequiresPstnAnswer(PRE_CONNECT_MEDIA_POLICY.NONE)).toBe(false);
    expect(policyPlaysGreeting(PRE_CONNECT_MEDIA_POLICY.NONE)).toBe(false);
    expect(policyPlaysRecordingNotice(PRE_CONNECT_MEDIA_POLICY.NONE)).toBe(false);
  });

  it('GREETING_AND_RECORDING plays both', () => {
    expect(policyPlaysGreeting(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING)).toBe(true);
    expect(policyPlaysRecordingNotice(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING)).toBe(true);
    expect(policyRequiresPstnAnswer(PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING)).toBe(true);
  });
});

describe('preConnectMediaPolicy / protected flows not forced to NONE', () => {
  it('after-hours closed message runs before IVR and preConnectMediaPolicy branches', () => {
    const afterHoursIdx = inboundSource.indexOf("encodeClientState({ stage: 'after_hours_closed' })");
    const ivrGatherIdx = inboundSource.indexOf("session.stage = 'ivr'");
    const preConnectResolveIdx = inboundSource.indexOf('resolvePreConnectMediaPolicy(');
    expect(afterHoursIdx).toBeGreaterThan(-1);
    expect(ivrGatherIdx).toBeGreaterThan(preConnectResolveIdx);
    expect(afterHoursIdx).toBeLessThan(ivrGatherIdx);
  });

  it('extension voicemail policy returns before preConnect greeting branch', () => {
    const vmIdx = inboundSource.indexOf("extPolicy?.action === 'voicemail'");
    const greetingPolicyIdx = inboundSource.indexOf('PRE_CONNECT_MEDIA_POLICY.GREETING');
    expect(vmIdx).toBeGreaterThan(-1);
    expect(vmIdx).toBeLessThan(greetingPolicyIdx);
  });

  it('transfer events bypass handleCallInitiated', () => {
    expect(inboundSource).toMatch(
      /case 'call\.initiated':[\s\S]*handleTransferCallControlEvent/,
    );
  });

  it('voicemail capture uses its own speak path not preConnectMediaPolicy NONE', () => {
    expect(inboundSource).toMatch(/async function startVoicemailCapture/);
    expect(inboundSource).toMatch(/encodeClientState\(\{ stage: 'voicemail_record' \}\)/);
  });

  it('AI receptionist is not wired through resolvePreConnectMediaPolicy', () => {
    expect(inboundSource).not.toMatch(/AI_RECEPTIONIST|aiReceptionist|gatherUsingAI/i);
  });
});
