/** VSP Phone V3 — type contracts */

export type V3NormalizedWebhook = {
  telnyxEventId: string | null;
  eventType: string;
  callControlId: string | null;
  callSessionId: string | null;
  direction: string | null;
  state: string | null;
  from: string | null;
  to: string | null;
  connectionId: string | null;
  correlationId: string;
  raw: Record<string, unknown>;
};

export type V3LegRecord = {
  id: string;
  sessionId: string;
  callControlId: string;
  role: string;
  state: string;
  connectionId?: string | null;
  direction?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  version: number;
  answeredAt?: Date | string | null;
  endedAt?: Date | string | null;
  hangupCause?: string | null;
};

export type V3SessionRecord = {
  id: string;
  tenantId: string | null;
  state: string;
  origin?: string | null;
  direction?: string | null;
  telnyxCallSessionId?: string | null;
  primaryCallControlId?: string | null;
  correlationId: string | null;
  version: number;
  engineVersion?: number;
  failureCode?: string | null;
  answeredAt?: Date | string | null;
  endedAt?: Date | string | null;
  callerExtensionId?: string | null;
  callerUserId?: string | null;
  calleeExtensionId?: string | null;
  routeSnapshot?: Record<string, unknown> | null;
  legs?: V3LegRecord[];
};

export type V3CreateSessionInput = {
  tenantId?: string | null;
  state?: string;
  origin?: string | null;
  direction?: string | null;
  telnyxCallSessionId?: string | null;
  primaryCallControlId?: string | null;
  correlationId?: string | null;
};

export type V3CreateLegInput = {
  sessionId: string;
  callControlId: string;
  role: string;
  state?: string;
  connectionId?: string | null;
  direction?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
};

export type V3CommandIntent = {
  commandType: string;
  reason?: string;
  payload?: Record<string, unknown>;
};

export type V3CommandIntentContext = {
  sessionId: string;
  legId?: string | null;
  tenantId?: string | null;
  correlationId?: string | null;
  targetCallControlId?: string | null;
  sequenceStart?: number;
};

export type V3EnqueueCommandIntentInput = V3CommandIntentContext & {
  commandType: string;
  reason?: string;
  payload?: Record<string, unknown>;
  sequence?: number;
};

export type V3DomainEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  sessionId: string;
  tenantId?: string | null;
  correlationId?: string | null;
  callControlId?: string | null;
  payload?: Record<string, unknown>;
};

export type V3PolicyContext = {
  eventId: string;
  sessionId: string;
  tenantId?: string | null;
  correlationId?: string | null;
  telnyxEventType: string;
  sessionState: string;
  legState: string;
};

export type V3PolicyDecision = {
  allowed: boolean;
  observeOnly: boolean;
  rules: Array<{ rule: string; result: string; message?: string }>;
  reason?: string;
};

export type V3IngressContext = {
  normalized: V3NormalizedWebhook;
  workerId: string;
  ingressId: string;
  traceId?: string | null;
};

export type V3OutboxCommandInput = {
  sessionId: string;
  legId?: string | null;
  commandType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
};

export type V3CommandFailureClass =
  | 'Retryable'
  | 'Permanent'
  | 'Carrier'
  | 'Validation'
  | 'Infrastructure'
  | 'Unknown';

export type V3CommandExecutionMeta = {
  startedAt?: string;
  completedAt?: string;
  attemptCount?: number;
  executionTimeMs?: number;
  workerId?: string;
  traceId?: string;
  sessionId?: string;
  legId?: string | null;
  tenantId?: string | null;
  commandType?: string;
  callControlId?: string | null;
  retryCount?: number;
  failureClass?: V3CommandFailureClass | null;
  lastError?: string | null;
  result?: Record<string, unknown> | null;
  status?: string;
};

export type V3TelnyxAdapterResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  action?: string | null;
  telnyxRequestId?: string | null;
  telnyxResult?: unknown;
  message?: string;
};

export type V3DeskPolicyDecision = {
  action: string;
  effectiveAction: string;
  enforced: boolean;
  observeOnly: boolean;
  allowed: boolean;
  reason: string;
  rules: Array<{ rule: string; result: string; message?: string }>;
  callerId?: { outboundNumber?: string | null; hideCallerId?: boolean; displayName?: string | null } | null;
  targets?: unknown[];
};

export type V3DeskRouteResult = {
  sessionId: string;
  tenantId: string | null;
  routingFlow: string;
  destinationType: string;
  destination: Record<string, unknown> | null;
  caller: Record<string, unknown> | null;
  targetExtension: Record<string, unknown> | null;
  policy: V3DeskPolicyDecision | null;
  commands: V3CommandIntent[];
  observeOnly: boolean;
  enforced: boolean;
  traceId?: string | null;
  error?: string | null;
};

export type V3MobilePolicyDecision = V3DeskPolicyDecision;

export type V3MobileRouteResult = {
  sessionId: string;
  tenantId: string | null;
  routingFlow: string;
  destinationType: string;
  destination: Record<string, unknown> | null;
  caller: Record<string, unknown> | null;
  targetExtension: Record<string, unknown> | null;
  policy: V3MobilePolicyDecision | null;
  commands: V3CommandIntent[];
  observeOnly: boolean;
  enforced: boolean;
  traceId?: string | null;
  error?: string | null;
};

export type V3PstnPolicyDecision = V3DeskPolicyDecision;

export type V3PstnRouteResult = {
  sessionId: string;
  tenantId: string | null;
  routingFlow: string;
  destinationType: string;
  destination: Record<string, unknown> | null;
  caller: Record<string, unknown> | null;
  targetExtension: Record<string, unknown> | null;
  phoneRecord: Record<string, unknown> | null;
  policy: V3PstnPolicyDecision | null;
  commands: V3CommandIntent[];
  observeOnly: boolean;
  enforced: boolean;
  traceId?: string | null;
  error?: string | null;
};

export type V3HoldPolicyDecision = {
  action: string;
  effectiveAction: string;
  enforced: boolean;
  observeOnly: boolean;
  allowed: boolean;
  reason: string;
  rules: Array<{ rule: string; result: string; message?: string }>;
};

export type V3TransferPolicyDecision = V3HoldPolicyDecision & {
  transferTimeoutSec?: number;
  maxTransferAttempts?: number;
  attemptCount?: number;
};

export type V3RecordingPolicyDecision = V3HoldPolicyDecision & {
  alwaysRecord?: boolean;
  recordInbound?: boolean;
  recordOutbound?: boolean;
  retentionDays?: number;
  retryCount?: number;
};

export type V3VoicemailPolicyDecision = V3HoldPolicyDecision & {
  greetingUrl?: string | null;
  mailboxId?: string | null;
  maxLength?: number;
  voicemailTimeoutSec?: number;
};

export type V3ConferencePolicyDecision = V3HoldPolicyDecision & {
  maxParticipants?: number;
  hostRequired?: boolean;
  conferenceTimeoutSec?: number;
  conferenceRecordingPolicy?: string;
};

export type V3QueuePolicyDecision = V3HoldPolicyDecision & {
  maxWaitingTimeSec?: number;
  maxRetries?: number;
  agentTimeoutSec?: number;
  maxQueueSize?: number;
  overflow?: boolean;
};

export type V3IvrPolicyDecision = V3HoldPolicyDecision & {
  maxRetries?: number;
  digitTimeoutSec?: number;
  operatorFallback?: boolean;
  holiday?: boolean;
};

export type V3FeatureFlagSnapshot = {
  tenantId: string;
  engineEnabled: boolean;
  deskEnabled: boolean;
  mobileEnabled: boolean;
  pstnEnabled: boolean;
  transferEnabled: boolean;
  holdEnabled: boolean;
  recordingEnabled: boolean;
  voicemailEnabled: boolean;
  conferenceEnabled: boolean;
  queueEnabled: boolean;
  ivrEnabled: boolean;
  observeOnly: boolean;
};

export type V3HealthReport = {
  ready: boolean;
  checks: {
    database: boolean;
    redis: boolean;
    workers: boolean;
    queueLag: boolean;
    queueDepth: boolean;
    dlq: boolean;
    outboxDead: boolean;
  };
  redis: { connected: boolean; required: boolean; latencyMs?: number; error?: string };
  database: { connected: boolean; latencyMs?: number; error?: string };
  workers: {
    healthy: boolean;
    activeCount: number;
    staleThresholdSec: number;
    workers?: Array<{ workerId: string; at: number; role?: string }>;
  };
  queue: {
    stream: string;
    depth: number;
    lagMs: number | null;
    pendingCount?: number;
    lagThresholdMs?: number;
    depthThreshold?: number;
  };
  dlq?: {
    stream: string;
    depth: number;
    depthThreshold?: number;
  };
  outbox: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    dead: number;
    deadThreshold?: number;
  };
  featureFlags: {
    globalEnabled: boolean;
    ingressEnabled: boolean;
    callManagerEnabled: boolean;
    outboxPaused: boolean;
    executorEnabled: boolean;
  };
  engineVersion: number;
};
