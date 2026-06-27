import type { ExtensionRecord, UserRole } from '../api/types';
import { authorizedRequest } from '../auth/authService';
import { fetchSoftphoneConfig, fetchSoftphoneToken } from '../calling/softphoneService';
import { fetchExtensions } from '../contacts/contactsService';
import { createTelnyxDefaultProfile, TELNYX_SIP_SERVER } from './defaults';
import type { SipProfile } from './types';

export type ExtensionSipCredentials = {
  sipUsername: string | null;
  sipPassword: string | null;
  sipServer: string;
  sipPort: number;
  sipPortTls: number;
  sipTransport: string;
  sipUri: string | null;
  outboundProxy: string;
  extensionNumber: string;
  displayName: string;
};

function isAdminRole(role?: UserRole | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN';
}

async function fetchExtensionSipCredentials(extensionId: string): Promise<ExtensionSipCredentials | null> {
  try {
    const response = await authorizedRequest<{ success?: boolean; sip: ExtensionSipCredentials }>(
      `/api/tenant/extensions/${extensionId}/sip`,
    );
    return response.sip ?? null;
  } catch {
    return null;
  }
}

function findUserExtension(extensions: ExtensionRecord[], userId: string): ExtensionRecord | null {
  return extensions.find((ext) => ext.userId === userId) ?? null;
}

function portForTransport(transport: string, sipPort: number, sipPortTls: number): string {
  if (transport === 'TLS') return String(sipPortTls || 5061);
  return String(sipPort || 5060);
}

export async function hydrateSipProfile(input: {
  userId: string;
  userName: string;
  userRole?: UserRole | null;
  stored?: SipProfile | null;
}): Promise<SipProfile> {
  const base = createTelnyxDefaultProfile({
    displayName: input.userName,
    ...(input.stored ?? {}),
  });

  const [configRes, extensions] = await Promise.all([
    fetchSoftphoneConfig().catch(() => null),
    fetchExtensions().catch(() => [] as ExtensionRecord[]),
  ]);

  const userExtension = findUserExtension(extensions, input.userId);
  let sipCredentials: ExtensionSipCredentials | null = null;

  if (userExtension && isAdminRole(input.userRole)) {
    sipCredentials = await fetchExtensionSipCredentials(userExtension.id);
  }

  const sipUsername = sipCredentials?.sipUsername
    ?? configRes?.sipUsername
    ?? base.sipUsername;

  const transport = base.transport;
  const sipPort = sipCredentials
    ? portForTransport(transport, sipCredentials.sipPort, sipCredentials.sipPortTls)
    : base.sipPort;

  return {
    ...base,
    profileName: base.profileName || `${input.userName || 'VSP'} SIP`,
    displayName: sipCredentials?.displayName || userExtension?.displayName || input.userName || base.displayName,
    extension: userExtension?.extensionNumber || base.extension,
    sipUsername: sipUsername || base.sipUsername,
    authUsername: sipCredentials?.sipUsername || sipUsername || base.authUsername,
    password: sipCredentials?.sipPassword || base.password,
    sipServer: sipCredentials?.sipServer || TELNYX_SIP_SERVER,
    sipPort,
    outboundProxy: sipCredentials?.outboundProxy || `${TELNYX_SIP_SERVER}:${sipPort}`,
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
