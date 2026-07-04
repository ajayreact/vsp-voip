import type { ExtensionRecord } from '../api/types';
import { authorizedRequest } from '../auth/authService';
import { fetchSoftphoneConfig, fetchSoftphoneToken } from '../calling/softphoneService';
import { fetchExtensions } from '../contacts/contactsService';
import { createTelnyxDefaultProfile, TELNYX_SIP_SERVER } from './defaults';
import type { SipProfile } from './types';

function portForTransport(transport: string, sipPort: number, sipPortTls: number): string {
  if (transport === 'TLS') return String(sipPortTls || 5061);
  return String(sipPort || 5060);
}

function findUserExtension(extensions: ExtensionRecord[], userId: string): ExtensionRecord | null {
  return extensions.find((ext) => ext.userId === userId) ?? null;
}

export async function hydrateSipProfile(input: {
  userId: string;
  userName: string;
  stored?: SipProfile | null;
}): Promise<SipProfile> {
  const base = createTelnyxDefaultProfile({
    displayName: input.userName,
    ...(input.stored ?? {}),
  });

  const [configRes, tokenRes, extensions] = await Promise.all([
    fetchSoftphoneConfig().catch(() => null),
    fetchSoftphoneToken().catch(() => null),
    fetchExtensions().catch(() => [] as ExtensionRecord[]),
  ]);

  const userExtension = findUserExtension(extensions, input.userId);
  const sipUsername = configRes?.sipUsername
    ?? tokenRes?.sipUsername
    ?? base.sipUsername;

  const transport = base.transport;
  const sipPort = portForTransport(transport, base.sipPort, base.sipPortTls);

  return {
    ...base,
    profileName: base.profileName || `${input.userName || 'VSP'} SIP`,
    displayName: userExtension?.displayName || input.userName || base.displayName,
    extension: userExtension?.extensionNumber || base.extension,
    sipUsername: sipUsername || base.sipUsername,
    authUsername: sipUsername || base.authUsername,
    password: base.password,
    loginToken: tokenRes?.loginToken || base.loginToken,
    sipServer: TELNYX_SIP_SERVER,
    sipPort,
    outboundProxy: `${TELNYX_SIP_SERVER}:${sipPort}`,
    callerId: userExtension?.assignedDidNumber || base.callerId,
  };
}

export async function testSipConnection(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const started = Date.now();
  try {
    const tokenRes = await fetchSoftphoneToken();
    const latencyMs = Date.now() - started;
    if (!tokenRes.loginToken?.trim()) {
      return {
        ok: false,
        latencyMs,
        message: 'Registration token unavailable. Contact your administrator.',
      };
    }
    return {
      ok: true,
      latencyMs,
      message: `Connection test passed (${latencyMs} ms).`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : 'Connection test failed.',
    };
  }
}

export async function fetchEmployeeSipCredentialsForDesk(extensionId: string) {
  return authorizedRequest<{ success?: boolean; sip: Record<string, unknown> }>(
    `/api/tenant/extensions/${extensionId}/sip`,
  );
}
