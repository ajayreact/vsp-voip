import { apiRequest, loginOrSkip, skipIfUnreachable } from './api-client';
import type { EndpointSpec } from './endpoints';

export type ProbeResult = {
  key: string;
  group: string;
  anonStatus: number;
  authedStatus?: number;
  ok: boolean;
  detail?: string;
};

export async function probeEndpoint(
  ep: EndpointSpec,
  token?: string,
): Promise<{ anon: number; authed?: number }> {
  const anonRes = await apiRequest(ep.path, {
    method: ep.method,
    body: ep.body,
  });
  if (skipIfUnreachable(anonRes)) {
    return { anon: 0 };
  }

  let authed: number | undefined;
  if (ep.auth !== 'public' && token) {
    const authedRes = await apiRequest(ep.path, {
      method: ep.method,
      token,
      body: ep.body,
    });
    authed = authedRes.status;
  }

  return { anon: anonRes.status, authed };
}

export function evaluateProbe(ep: EndpointSpec, anon: number, authed?: number): ProbeResult {
  const key = `${ep.method} ${ep.path}`;
  const anonOk = ep.anonAccept.includes(anon);

  if (ep.auth === 'public') {
    return {
      key,
      group: ep.group,
      anonStatus: anon,
      ok: anonOk,
      detail: anonOk ? undefined : `expected anon in [${ep.anonAccept.join(',')}], got ${anon}`,
    };
  }

  const authedAccept = ep.authedAccept ?? [200, 400, 403, 404];
  const authedOk = authed === undefined ? false : authedAccept.includes(authed);

  return {
    key,
    group: ep.group,
    anonStatus: anon,
    authedStatus: authed,
    ok: anonOk && authedOk,
    detail: !anonOk
      ? `anon expected [${ep.anonAccept.join(',')}], got ${anon}`
      : !authedOk
        ? `authed expected [${authedAccept.join(',')}], got ${authed}`
        : undefined,
  };
}

export async function probeAllEndpoints(
  endpoints: EndpointSpec[],
): Promise<{ results: ProbeResult[]; skipped: boolean }> {
  const session = await loginOrSkip();
  if (!session) {
    return { results: [], skipped: true };
  }

  const results: ProbeResult[] = [];
  for (const ep of endpoints) {
    const { anon, authed } = await probeEndpoint(ep, session.token);
    if (anon === 0) {
      return { results: [], skipped: true };
    }
    results.push(evaluateProbe(ep, anon, authed));
  }

  return { results, skipped: false };
}
