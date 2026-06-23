const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantContactEmail?: string | null;
  tenantTimezone?: string | null;
};

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vsp_token');
}

export function setToken(token: string) {
  localStorage.setItem('vsp_token', token);
}

export function clearToken() {
  localStorage.removeItem('vsp_token');
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isUnauthorizedError(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach API at ${API_URL}. Start the backend with npm run dev:api in a separate terminal.`,
      0,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export async function login(email: string, password: string) {
  return apiFetch<{ accessToken: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function forgotPassword(email: string) {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function getMe() {
  return apiFetch<User>('/api/auth/me');
}

export async function getDashboardStats() {
  return apiFetch<{
    callCount: number;
    numberCount: number;
    unreadVoicemailCount: number;
    unreadSmsCount: number;
    pendingOrdersCount: number;
    recentOrders: NumberOrder[];
    recentCalls: Array<{
      id: string;
      from: string;
      to: string;
      status: string;
      createdAt: string;
      tenant?: { name: string };
    }>;
  }>('/api/dashboard/stats');
}

export async function getCalls(limit = 50) {
  return apiFetch<{
    success: boolean;
    calls: Array<{
      id: string;
      callSid: string;
      from: string;
      to: string;
      direction: string;
      status: string;
      callType: string;
      durationSeconds: number | null;
      durationLabel: string;
      createdAt: string;
      endedAt: string | null;
      recordingId: string | null;
      recordingUrl: string | null;
    }>;
  }>(`/api/calls?limit=${limit}`);
}

export async function getGreeting(tenantId: string) {
  return apiFetch<{
    message: string;
    preview: string;
    tenantName: string;
  }>(`/api/tenants/${tenantId}/greeting`);
}

export type IvrOption = {
  digit: string;
  label: string;
  action: 'message' | 'forward' | 'ring_group';
  message: string;
  forwardTo: string;
};

export type GreetingRingGroupMember = {
  type?: 'phone' | 'app';
  phone?: string;
  userId?: string | null;
  label: string;
};

export type CallRoutingConfig = {
  tenantId: string;
  tenantName: string;
  timezone: string;
  message: string;
  preview: string;
  voice: string;
  afterHoursMessage: string;
  afterHoursPreview: string;
  businessHoursEnabled: boolean;
  businessHours: Record<string, { enabled: boolean; open: string; close: string }> | null;
  ivrEnabled: boolean;
  ivrPrompt: string;
  ivrOptions: IvrOption[];
  forwardEnabled: boolean;
  forwardNumber: string;
  playGreetingBeforeConnect: boolean;
  ringGroupEnabled: boolean;
  ringGroupName: string;
  ringGroupMembers: GreetingRingGroupMember[];
  ringStrategy: 'simultaneous' | 'sequential';
  ringTimeout: number;
  noAnswerMessage: string;
  noAnswerPreview: string;
  voicemailEnabled: boolean;
  voicemailPrompt: string;
  voicemailPromptPreview: string;
  voicemailMaxLength: number;
  afterHoursVoicemailEnabled: boolean;
  callRecordingEnabled: boolean;
  callRecordingNotice: string;
  callRecordingNoticePreview: string;
  playCallRecordingNotice: boolean;
  greetingAudioUrl?: string;
  ivrPromptAudioUrl?: string;
};

export async function getCallRouting(tenantId: string) {
  return apiFetch<{ routing: CallRoutingConfig }>(`/api/tenants/${tenantId}/call-routing`);
}

export async function saveCallRouting(
  tenantId: string,
  data: {
    message: string;
    afterHoursMessage?: string;
    businessHoursEnabled?: boolean;
    businessHours?: CallRoutingConfig['businessHours'];
    ivrEnabled?: boolean;
    ivrPrompt?: string;
    ivrOptions?: IvrOption[];
    forwardEnabled?: boolean;
    forwardNumber?: string;
    playGreetingBeforeConnect?: boolean;
    ringGroupEnabled?: boolean;
    ringGroupName?: string;
    ringGroupMembers?: GreetingRingGroupMember[];
    ringStrategy?: CallRoutingConfig['ringStrategy'];
    ringTimeout?: number;
    noAnswerMessage?: string;
    voicemailEnabled?: boolean;
    voicemailPrompt?: string;
    voicemailMaxLength?: number;
    afterHoursVoicemailEnabled?: boolean;
    callRecordingEnabled?: boolean;
    callRecordingNotice?: string;
    playCallRecordingNotice?: boolean;
    voice?: string;
    greetingAudioUrl?: string;
    ivrPromptAudioUrl?: string;
  },
) {
  return apiFetch<{ routing: CallRoutingConfig }>(`/api/tenants/${tenantId}/call-routing`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type VoicemailRecord = {
  id: string;
  tenantId: string;
  callSid: string | null;
  recordingSid: string | null;
  from: string;
  to: string;
  recordingUrl: string;
  durationSeconds: number | null;
  isRead: boolean;
  createdAt: string;
};

export async function getVoicemails(limit = 50) {
  return apiFetch<{ success: boolean; count: number; voicemails: VoicemailRecord[] }>(
    `/api/tenant/voicemails?limit=${limit}`,
  );
}

export async function markVoicemailRead(id: string) {
  return apiFetch<{ success: boolean; voicemail: VoicemailRecord }>(
    `/api/tenant/voicemails/${id}/read`,
    { method: 'PATCH' },
  );
}

export async function deleteVoicemail(id: string) {
  return apiFetch<{ success: boolean }>(`/api/tenant/voicemails/${id}`, { method: 'DELETE' });
}

export type CallRecordingRecord = {
  id: string;
  tenantId: string;
  callSid: string | null;
  recordingSid: string | null;
  from: string;
  to: string;
  direction: string;
  recordingUrl: string;
  durationSeconds: number | null;
  createdAt: string;
};

export async function getCallRecordings(limit = 50) {
  return apiFetch<{ success: boolean; count: number; recordings: CallRecordingRecord[] }>(
    `/api/tenant/recordings?limit=${limit}`,
  );
}

export type RecordingSetupStatus = {
  apiPublicUrlConfigured: boolean;
  apiPublicUrl: string | null;
  voiceWebhookUrl: string;
  callRecordingWebhookUrl: string;
  credentialConnectionId: string | null;
  credentialWebhookConfigured: boolean;
  credentialWebhookUrl: string | null;
  outboundVoiceProfileId: string | null;
  outboundRecordingEnabled: boolean;
  webhooksReachable: boolean;
  message: string;
};

export async function getRecordingSetupStatus() {
  return apiFetch<{ success: boolean; setup: RecordingSetupStatus }>('/api/tenant/recordings/setup');
}

export async function syncCallRecordings() {
  return apiFetch<{ success: boolean; imported: number; skipped: number; total: number }>(
    '/api/tenant/recordings/sync',
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function deleteCallRecording(id: string) {
  return apiFetch<{ success: boolean }>(`/api/tenant/recordings/${id}`, { method: 'DELETE' });
}

export type SoftphoneConfig = {
  configured: boolean;
  credentialConnectionId: string | null;
  sipUsername?: string | null;
  webrtcSession?: {
    sipUsername: string | null;
    dialUri: string | null;
    credentialConnectionId: string | null;
    note: string;
  };
  numbers: { id: string; number: string }[];
  defaultCallerId: string | null;
  callRecordingEnabled: boolean;
  voiceWebhookUrl: string;
  callRecordingWebhookUrl: string;
  webrtcSetup?: {
    outboundVoiceProfileId: string | null;
    outboundReady: boolean;
    credentialWebhookConfigured: boolean;
    webhooksReachable: boolean;
    message: string;
  };
  telnyxArchitecture?: {
    inbound: {
      resource: string;
      name: string | null;
      id: string | null;
      webhookUrl: string;
      numberAssignment: string;
    };
    outboundWebRtc: {
      resource: string;
      name: string | null;
      id: string | null;
      webhookUrl: string;
      outboundVoiceProfileId: string | null;
      note: string;
    };
  };
  inboundRouting?: {
    ringGroupEnabled: boolean;
    inAppRingGroup: boolean;
    ready: boolean;
    message?: string;
  };
  callControlSetup?: {
    applicationId: string | null;
    applicationName?: string | null;
    callControlWebhookUrl: string;
    webhooksReachable: boolean;
    applicationWebhookConfigured: boolean;
    message: string;
  };
};

export async function getSoftphoneConfig() {
  return apiFetch<{ success: boolean } & SoftphoneConfig>('/api/softphone/config');
}

export async function getSoftphoneToken() {
  return apiFetch<{
    success: boolean;
    loginToken: string;
    sipUsername?: string;
    credentialConnectionId?: string | null;
    expiresInSeconds: number;
  }>('/api/softphone/token', { method: 'POST' });
}

export async function setSoftphonePresence(online: boolean) {
  return apiFetch<{ success: boolean; online: boolean }>('/api/softphone/presence', {
    method: 'POST',
    body: JSON.stringify({ online }),
  });
}

export async function initiateInternalExtensionCall(extensionNumber: string) {
  return apiFetch<{
    success: boolean;
    callControlId: string;
    targetExtensionNumber: string;
    targetDisplayName: string | null;
    ringStrategy: string;
    targetCount: number;
    policyAction: string;
  }>('/api/softphone/internal-call', {
    method: 'POST',
    body: JSON.stringify({ extensionNumber }),
  });
}

export async function logSoftphoneCall(data: {
  callSid?: string;
  from: string;
  to: string;
  status?: string;
}) {
  return apiFetch<{ success: boolean }>('/api/softphone/call-log', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startSoftphoneRecording(data: {
  callControlId: string;
  from: string;
  to: string;
}) {
  return apiFetch<{ success: boolean; started: boolean; callControlId: string }>(
    '/api/softphone/record-start',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export type SmsMessageRecord = {
  id: string;
  tenantId: string;
  telnyxMessageId: string | null;
  from: string;
  to: string;
  body: string;
  direction: string;
  status: string;
  deliveryError?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type SmsConversation = {
  peer: string;
  line: string;
  lastMessage: SmsMessageRecord;
  unreadCount: number;
};

export type SmsMessagingSetup = {
  messagingProfileId: string | null;
  profileName: string | null;
  smsWebhookUrl: string;
  webhooksReachable: boolean;
  profileWebhookConfigured: boolean;
  profileWebhookUrl: string | null;
  numbersOnProfile: {
    number: string;
    onProfile: boolean;
    messagingProfileId: string | null;
  }[];
  message: string;
};

export type SmsConfig = {
  configured: boolean;
  messagingProfileId: string | null;
  numbers: { id: string; number: string }[];
  defaultFrom: string | null;
  smsWebhookUrl: string;
  webhookReachable: boolean;
  messagingSetup?: SmsMessagingSetup;
};

export async function getSmsConfig() {
  return apiFetch<{ success: boolean } & SmsConfig>('/api/sms/config');
}

export async function getSmsConversations() {
  return apiFetch<{ success: boolean; count: number; conversations: SmsConversation[] }>(
    '/api/sms/conversations',
  );
}

export async function getSmsMessages(peer: string, line: string, limit = 200) {
  const q = new URLSearchParams({ peer, line, limit: String(limit) });
  return apiFetch<{ success: boolean; count: number; messages: SmsMessageRecord[] }>(
    `/api/sms/messages?${q.toString()}`,
  );
}

export async function markSmsConversationRead(peer: string, line: string) {
  return apiFetch<{ success: boolean; updated: number }>('/api/sms/conversations/read', {
    method: 'PATCH',
    body: JSON.stringify({ peer, line }),
  });
}

export async function sendSms(data: { from: string; to: string; text: string }) {
  return apiFetch<{ success: boolean; message: SmsMessageRecord }>('/api/sms/send', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteSmsMessage(id: string) {
  return apiFetch<{ success: boolean }>(`/api/sms/messages/${id}`, { method: 'DELETE' });
}

export async function saveGreeting(tenantId: string, message: string) {
  return apiFetch<{ preview: string }>(`/api/tenants/${tenantId}/greeting`, {
    method: 'PUT',
    body: JSON.stringify({ message }),
  });
}

export type NumberSearchFilters = {
  country?: string;
  features?: string;
  phoneNumberType?: string;
  searchBy?: 'area_code' | 'locality' | 'state';
  searchValue?: string;
  patternType?: '' | 'starts_with' | 'ends_with' | 'contains';
  patternValue?: string;
  consecutive?: number;
  limit?: number;
  bestEffort?: boolean;
  quickship?: boolean;
  reservable?: boolean;
  excludeHeldNumbers?: boolean;
};

export type AvailableNumber = {
  phoneNumber: string;
  locality: string;
  state: string;
  country: string;
  phoneNumberType: string;
  features: string[];
  upfrontCost: string | null;
  monthlyCost: string | null;
  currency: string;
};

export async function getAreaCodes(country = 'US') {
  const q = new URLSearchParams({ country });
  return apiFetch<{ areaCodes: string[]; count: number }>(`/api/numbers/area-codes?${q.toString()}`);
}

export async function searchNumbers(filters: NumberSearchFilters) {
  const q = new URLSearchParams();
  if (filters.country) q.set('country', filters.country);
  if (filters.features) q.set('features', filters.features);
  if (filters.phoneNumberType) q.set('phoneNumberType', filters.phoneNumberType);
  if (filters.searchBy) q.set('searchBy', filters.searchBy);
  if (filters.searchValue) q.set('searchValue', filters.searchValue);
  if (filters.patternType) q.set('patternType', filters.patternType);
  if (filters.patternValue) q.set('patternValue', filters.patternValue);
  if (filters.consecutive) q.set('consecutive', String(filters.consecutive));
  if (filters.limit) q.set('limit', String(filters.limit));
  if (filters.bestEffort !== undefined) q.set('bestEffort', String(filters.bestEffort));
  if (filters.quickship !== undefined) q.set('quickship', String(filters.quickship));
  if (filters.reservable !== undefined) q.set('reservable', String(filters.reservable));
  if (filters.excludeHeldNumbers !== undefined) {
    q.set('excludeHeldNumbers', String(filters.excludeHeldNumbers));
  }
  return apiFetch<{ availableNumbers: AvailableNumber[]; count: number }>(
    `/api/numbers/search?${q.toString()}`
  );
}

export type OwnedNumber = {
  id: string;
  number: string;
  numberFormatted?: string;
  tenantId: string;
  label?: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  extensionId?: string | null;
  extensionNumber?: string | null;
  extensionName?: string | null;
  isExtensionManaged?: boolean;
  routingType?: string;
  routingTypeLabel?: string;
  effectiveRoutingType?: string;
  effectiveRoutingLabel?: string;
  forwardDestination?: string | null;
  destination?: string;
  isActive?: boolean;
  carrierMonthly: number | null;
  platformMonthly: number | null;
  tenantMonthlyTotal: number | null;
  createdAt: string;
};

export type ExtensionOption = {
  id: string;
  label: string;
  extensionNumber: string;
  displayName: string;
};

export type TenantTeamUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  assignedExtension?: {
    id: string;
    extensionNumber: string;
    displayName: string;
    department: string | null;
  } | null;
};

export async function getMyNumbers() {
  return apiFetch<{
    numbers: OwnedNumber[];
    users: TenantTeamUser[];
    extensions: ExtensionOption[];
  }>('/api/numbers/mine');
}

export async function updatePhoneNumberRouting(
  id: string,
  data: {
    label?: string;
    routingType?: string;
    forwardDestination?: string;
    ringGroupId?: string | null;
    isActive?: boolean;
  },
) {
  return apiFetch<{ number: OwnedNumber; routingTypes: string[] }>(`/api/numbers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function buyNumber(
  phoneNumber: string,
  options?: { tenantId?: string; upfrontCost?: string; monthlyCost?: string; items?: AvailableNumber[] },
) {
  return apiFetch<{
    message: string;
    data: OwnedNumber;
    connectionAssigned: boolean;
    texmlConfigured: boolean;
    order?: NumberOrder;
  }>('/api/numbers/buy', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber,
      tenantId: options?.tenantId,
      upfrontCost: options?.upfrontCost,
      monthlyCost: options?.monthlyCost,
      items: options?.items,
    }),
  });
}

export type VoiceConnection = {
  id: string;
  label: string;
  type: string;
};

export async function getConnections() {
  return apiFetch<{ connections: VoiceConnection[]; defaultConnectionId: string | null }>(
    '/api/numbers/connections',
  );
}

export async function checkoutNumbers(
  phoneNumbers: string[],
  options?: {
    connectionId?: string;
    tenantId?: string;
    items?: AvailableNumber[];
    billTenantAutomatically?: boolean;
  },
) {
  const connectionId = options?.connectionId;
  const tenantId = options?.tenantId;
  const items = options?.items;
  const billTenantAutomatically = options?.billTenantAutomatically;
  return apiFetch<{
    message: string;
    purchased: Array<{ phoneNumber: string; message: string }>;
    failed: Array<{ phoneNumber: string; error: string }>;
    order?: NumberOrder;
  }>('/api/numbers/checkout', {
    method: 'POST',
    body: JSON.stringify({ phoneNumbers, connectionId, tenantId, items, billTenantAutomatically }),
  });
}

export type CheckoutGateway = {
  id: 'bank' | 'stripe' | 'razorpay';
  label: string;
  available: boolean;
  placeholder?: boolean;
  mode?: 'test' | 'live';
};

export type BillingConfig = {
  platformFeeSetup: number;
  platformFeeMonthly: number;
  platformFeeFirstMonth: number;
  currency: string;
  stripeEnabled: boolean;
  manualPaymentEnabled: boolean;
  razorpayEnabled?: boolean;
  razorpayVisible?: boolean;
  gateways?: CheckoutGateway[];
  bankDetails?: {
    bankAccountName: string;
    bankName: string;
    bankAccountNumber: string;
    bankIfscSwift: string;
    bankBranch: string;
    bankPaymentInstructions: string;
  } | null;
};

export async function getBillingConfig() {
  return apiFetch<BillingConfig & { success: boolean }>('/api/billing/config');
}

export async function createBillingCheckoutSession(
  items: AvailableNumber[],
  connectionId?: string,
) {
  return apiFetch<{ url: string; orderId: string; sessionId: string }>(
    '/api/billing/checkout-session',
    {
      method: 'POST',
      body: JSON.stringify({ items, connectionId }),
    },
  );
}

export async function createRazorpayOrder(items: AvailableNumber[], connectionId?: string) {
  return apiFetch<{
    orderId: string;
    invoiceNumber: string;
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    currency: string;
    amountUsd: number;
    mode: 'test' | 'live';
  }>('/api/billing/razorpay-order', {
    method: 'POST',
    body: JSON.stringify({ items, connectionId }),
  });
}

export async function verifyRazorpayPayment(payload: {
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}) {
  return apiFetch<{
    message: string;
    purchased: Array<{ phoneNumber: string; message: string }>;
    failed: Array<{ phoneNumber: string; error: string }>;
    alreadyFulfilled: boolean;
    order: NumberOrder;
  }>('/api/billing/razorpay-verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAdminRazorpayPaymentsReport() {
  return apiFetch<{ summary: Record<string, number>; payments: Array<Record<string, unknown>> }>(
    '/api/admin/reports/razorpay/payments',
  );
}

export async function getAdminRazorpayRefundsReport() {
  return apiFetch<{ summary: Record<string, number>; refunds: Array<Record<string, unknown>> }>(
    '/api/admin/reports/razorpay/refunds',
  );
}

export async function getAdminRevenueByGatewayReport() {
  return apiFetch<{
    totals: Record<string, number>;
    gateways: Array<{ paymentMethod: string; revenue: number; refunds: number; net: number; orderCount: number }>;
  }>('/api/admin/reports/revenue-by-gateway');
}

export async function refundAdminRazorpayOrder(id: string, reason?: string, amount?: number) {
  return apiFetch<{ refundId: string; amount: number; order: NumberOrder }>(
    `/api/admin/orders/${id}/razorpay-refund`,
    { method: 'POST', body: JSON.stringify({ reason, amount }) },
  );
}

export async function completeBillingCheckout(sessionId: string) {
  return apiFetch<{
    message: string;
    purchased: Array<{ phoneNumber: string; message: string }>;
    failed: Array<{ phoneNumber: string; error: string }>;
    alreadyFulfilled: boolean;
  }>('/api/billing/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function createManualOrder(items: AvailableNumber[], connectionId?: string) {
  return apiFetch<{
    order: NumberOrder;
    invoice: InvoicePreview;
  }>('/api/billing/manual-order', {
    method: 'POST',
    body: JSON.stringify({ items, connectionId }),
  });
}

export type InvoicePreview = {
  invoiceNumber: string;
  subject: string;
  body: string;
  dueAmount: string;
  recurringAmount: string;
  phoneNumbers: string[];
};

export type NumberOrder = {
  id: string;
  tenantId?: string;
  tenantName?: string;
  status: string;
  paymentMethod: string;
  invoiceNumber: string | null;
  invoiceSentAt: string | null;
  invoicePaidAt?: string | null;
  invoiceEmailTo: string | null;
  adminNotes: string | null;
  paymentReference: string | null;
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentReviewStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  totalCharged: number | string;
  platformFee: number | string;
  carrierUpfront?: number;
  carrierMonthly?: number;
  recurringMonthly?: number;
  phoneNumbers: string[];
  paymentFailureReason?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  refundedAt?: string | null;
  fulfillmentNote: string | null;
  createdAt: string;
};

export async function uploadOrderPaymentProof(orderId: string, file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  return apiFetch<{ order: NumberOrder }>(`/api/billing/orders/${orderId}/payment-proof`, {
    method: 'POST',
    body: JSON.stringify({ data, filename: file.name }),
  });
}

export type PaymentGatewaySettings = {
  bankTransferEnabled: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  stripeMode: 'test' | 'live';
  razorpayMode: 'test' | 'live';
  displayOrder: string[];
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfscSwift: string;
  bankBranch: string;
  bankPaymentInstructions: string;
  bankConfigured: boolean;
  stripeKeysConfigured: boolean;
  razorpayKeyIdPreview: string | null;
  razorpayConfigured: boolean;
  checkoutGateways: CheckoutGateway[];
};

export async function getAdminPaymentGateways() {
  return apiFetch<{ settings: PaymentGatewaySettings }>('/api/admin/payment-gateways');
}

export async function updateAdminPaymentGateways(data: Partial<PaymentGatewaySettings> & {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
}) {
  return apiFetch<{ settings: PaymentGatewaySettings }>('/api/admin/payment-gateways', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getAdminBankPaymentStats() {
  return apiFetch<{ stats: { pending: number; approved: number; rejected: number } }>(
    '/api/admin/payment-gateways/bank-stats',
  );
}

export async function approveAdminOrderPayment(
  id: string,
  data?: { adminNotes?: string; paymentReference?: string },
) {
  return apiFetch<{
    success: boolean;
    message: string;
    purchased: Array<{ phoneNumber: string; message: string }>;
    failed: Array<{ phoneNumber: string; error: string }>;
    order: NumberOrder;
  }>(`/api/admin/orders/${id}/approve-payment`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

export async function rejectAdminOrderPayment(id: string, adminNotes?: string) {
  return apiFetch<{ order: NumberOrder }>(`/api/admin/orders/${id}/reject-payment`, {
    method: 'POST',
    body: JSON.stringify({ adminNotes }),
  });
}

export type RevenueProtectionDashboard = {
  paidOrders: number;
  pendingPayments: number;
  unpaidFulfillments: number;
  numbersWithoutInvoice: number;
  marginNumbersTracked: number;
  totals: {
    upfrontGrossProfit: number;
    monthlyGrossProfit: number;
    monthlyMrr: number;
    carrierMonthlyCost: number;
    carrierUpfrontCost: number;
    grossProfitMonthly: number;
  };
  marginByTenant: Array<{
    tenantId: string;
    tenantName: string;
    numberCount: number;
    monthlyGrossProfit: number;
    upfrontGrossProfit: number;
    customerMrr: number;
    carrierMonthlyCost: number;
  }>;
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    createdAt: string;
  }>;
};

export async function getAdminRevenueProtection() {
  return apiFetch<{ dashboard: RevenueProtectionDashboard }>('/api/admin/revenue-protection');
}

export type RevenueReconcileReport = {
  dryRun: boolean;
  scannedAt: string;
  ordersScanned: number;
  ordersRepaired: Array<Record<string, unknown>>;
  phonesRepaired: Array<Record<string, unknown>>;
  receivablesUpdated: Array<Record<string, unknown>>;
  alertsResolved: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  dashboard: RevenueProtectionDashboard;
};

export async function reconcileAdminRevenue(dryRun = false) {
  return apiFetch<{ report: RevenueReconcileReport }>('/api/admin/revenue/reconcile', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  });
}

export async function runAdminBillingIntegrity() {
  return apiFetch<{ alertCount: number; alerts: Array<{ id: string; type: string; message: string }> }>(
    '/api/admin/billing-integrity/run',
    { method: 'POST' },
  );
}

export async function getAdminBillingIntegrityAlerts(resolved = false) {
  const q = resolved ? '?resolved=true' : '';
  return apiFetch<{ alerts: Array<{ id: string; type: string; severity: string; message: string; createdAt: string }> }>(
    `/api/admin/billing-integrity/alerts${q}`,
  );
}

export async function resolveAdminBillingAlert(id: string) {
  return apiFetch<{ alert: { id: string } }>(`/api/admin/billing-integrity/alerts/${id}/resolve`, {
    method: 'POST',
  });
}

export async function getBillingOrders() {
  return apiFetch<{ orders: NumberOrder[] }>('/api/billing/orders');
}

export async function getBillingOrder(id: string) {
  return apiFetch<{ order: NumberOrder }>(`/api/billing/orders/${id}`);
}

export function getBillingInvoiceDownloadUrl(orderId: string) {
  return `/api/billing/orders/${orderId}/invoice/download`;
}

export async function downloadBillingInvoice(orderId: string) {
  const res = await fetch(`${API_URL}/api/billing/orders/${orderId}/invoice/download`, {
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || 'Download failed', res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || `invoice-${orderId}.txt`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function openStripeBillingPortal(returnUrl?: string) {
  return apiFetch<{ url: string }>('/api/billing/billing-portal', {
    method: 'POST',
    body: JSON.stringify({ returnUrl }),
  });
}

export async function uploadGreetingAudio(field: 'greetingAudioUrl' | 'ivrPromptAudioUrl', file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  return apiFetch<{ url: string; routing: CallRoutingConfig }>('/api/tenant/greeting/audio', {
    method: 'POST',
    body: JSON.stringify({ data, filename: file.name, field }),
  });
}

export type TenantProfile = {
  id: string;
  name: string;
  contactEmail: string;
  timezone: string;
};

export async function getTenantProfile() {
  return apiFetch<{ profile: TenantProfile }>('/api/tenant/profile');
}

export async function updateTenantProfile(data: { contactEmail?: string; timezone?: string }) {
  return apiFetch<{ profile: TenantProfile }>('/api/tenant/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getTenantUsers() {
  return apiFetch<{ users: TenantTeamUser[] }>('/api/tenant/users');
}

export async function createTeamUser(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
}) {
  return apiFetch<{ user: TenantTeamUser }>('/api/tenant/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type TenantSubscriptionSummary = {
  stripeEnabled: boolean;
  manualPaymentEnabled: boolean;
  hasStripeSubscription: boolean;
  stripeCustomerConfigured: boolean;
  stripeSubscription: {
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  activeNumbers: Array<{
    id: string;
    number: string;
    carrierMonthly: number | null;
    platformMonthly: number | null;
    tenantMonthlyTotal: number | null;
    hasStripeBilling: boolean;
    createdAt: string;
  }>;
  estimatedMonthlyTotal: number;
  numberCount: number;
};

export async function getTenantSubscription() {
  return apiFetch<{ summary: TenantSubscriptionSummary }>('/api/tenant/subscription');
}

export type AdminTenant = {
  id: string;
  name: string;
  isActive?: boolean;
  platformFeeSetup: number;
  platformFeeMonthly: number;
  platformFeeFirstMonth: number | null;
  numberCount: number;
  userCount: number;
  createdAt: string;
};

export type AdminDashboardKpis = {
  tenantGrowthPercent: number;
  mrrEstimate: number;
  arrEstimate?: number;
  totalUsers?: number;
  totalExtensions: number;
  activeConcurrentCalls: number;
  maxConcurrentCapacity: number;
  callsLast24h: number;
  callsToday?: number;
  callsThisMonth?: number;
  smsToday?: number;
  callSuccessRate?: number | null;
  callFailureRate?: number | null;
  avgCallDurationSeconds?: number | null;
  averageMos: number | null;
  averageMosSource?: string;
  averageMosSamples?: number;
  sipRegistrationRate: number | null;
  sipRegistrationSource?: {
    telnyxApi?: number;
    portalPresence?: number;
    telnyxWebhook?: number;
  };
  sipRegisteredExtensions?: number;
  activeStripeSubscriptions: number;
  pendingLnpRequests: number;
  availableDidPool: number | null;
  inventoryPurchased?: number;
  carrierBalanceNote: string | null;
};

export type AdminDashboardStats = {
  tenantCount: number;
  activeTenantCount: number;
  suspendedTenantCount: number;
  phoneNumberCount: number;
  assignedNumbers?: number;
  releasedNumbers?: number;
  pendingBankOrders: number;
  bankPaymentsPending?: number;
  bankPaymentsApproved?: number;
  bankPaymentsRejected?: number;
  revenueTotal: number;
  stripeEnabled: boolean;
  manualPaymentEnabled: boolean;
  razorpayEnabled?: boolean;
  smtpConfigured: boolean;
  telnyxConnected: boolean;
  telnyxApiKeyConfigured: boolean;
  kpis?: AdminDashboardKpis;
  platformHealth?: {
    score: number;
    status: string;
    checks: { telnyx: boolean; stripe: boolean; smtp: boolean; api: boolean };
  };
};

export type AdminTimeseriesPoint = {
  date: string;
  calls: number;
  newTenants: number;
  revenue: number;
};

export type AdminSystemAlert = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type AdminRecentTenant = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
};

export async function getAdminExecutiveDashboard() {
  return apiFetch<{
    stats: AdminDashboardStats;
    recentOrders: NumberOrder[];
    recentTenants: AdminRecentTenant[];
    telnyxStatus: TelnyxStatus;
    billingAlerts: AdminAuditEntry[];
    timeseries: AdminTimeseriesPoint[];
    systemAlerts: AdminSystemAlert[];
  }>('/api/admin/dashboard/executive');
}

export async function getAdminOperationsDashboard() {
  return apiFetch<{
    stats: AdminDashboardStats;
    telnyxStatus: TelnyxStatus;
    telemetry: Record<string, unknown>;
    voiceQuality: VoiceQualityReport;
  }>('/api/admin/dashboard/operations');
}

export async function getAdminDashboard() {
  return getAdminExecutiveDashboard();
}

export async function getAdminTenants() {
  return apiFetch<{ tenants: AdminTenant[] }>('/api/admin/tenants');
}

export async function getAdminTenant(id: string) {
  return apiFetch<{ tenant: AdminTenant & { users: User[]; phoneNumbers: OwnedNumber[] } }>(
    `/api/admin/tenants/${id}`,
  );
}

export async function createAdminTenant(data: {
  name: string;
  platformFeeSetup?: number;
  platformFeeMonthly?: number;
  platformFeeFirstMonth?: number | null;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}) {
  return apiFetch<{
    tenant: AdminTenant;
    adminUser?: { id: string; email: string; name: string; role: string } | null;
  }>('/api/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cleanupEmptyTenants() {
  return apiFetch<{ success: boolean; removed: number; message: string }>(
    '/api/admin/tenants/cleanup-empty',
    { method: 'POST' },
  );
}

export async function updateTenantBilling(
  id: string,
  data: {
    platformFeeSetup?: number;
    platformFeeMonthly?: number;
    platformFeeFirstMonth?: number | null;
  },
) {
  return apiFetch<{ tenant: AdminTenant; billing: BillingConfig }>(
    `/api/admin/tenants/${id}/billing`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
}

export async function updateTenantStatus(id: string, isActive: boolean) {
  return apiFetch<{ tenant: AdminTenant }>(`/api/admin/tenants/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });
}

export async function updateAdminTenant(id: string, data: { name: string }) {
  return apiFetch<{ tenant: AdminTenant }>(`/api/admin/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function createTenantUser(
  tenantId: string,
  data: { email: string; name: string; password: string; role?: string },
) {
  return apiFetch<{ user: User }>(`/api/admin/tenants/${tenantId}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type PlatformSettings = {
  stripePublishableKey: string;
  stripeSecretKeyConfigured: boolean;
  stripeSecretKeyPreview: string | null;
  stripeWebhookConfigured: boolean;
  stripeWebhookPreview: string | null;
  stripeEnabled: boolean;
  manualPaymentEnabled: boolean;
  defaultFeeSetup: number;
  defaultFeeMonthly: number;
  defaultFeeFirstMonth: number | null;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  bankSwiftCode: string;
  bankPaymentInstructions: string;
  invoiceContactEmail: string;
  telnyxConnectionId: string;
  telnyxConnectionName: string;
  telnyxCredentialConnectionId: string;
  telnyxMessagingProfileId: string;
  telnyxCallControlApplicationId: string;
  webhookUrl: string;
  smsWebhookUrl: string;
  callControlWebhookUrl: string;
};

export async function getPlatformSettings() {
  return apiFetch<{ settings: PlatformSettings }>('/api/admin/platform-settings');
}

export async function updatePlatformSettings(data: {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePublishableKey?: string;
  defaultFeeSetup?: number;
  defaultFeeMonthly?: number;
  defaultFeeFirstMonth?: number | null;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwiftCode?: string;
  bankPaymentInstructions?: string;
  invoiceContactEmail?: string;
  telnyxConnectionId?: string;
  telnyxConnectionName?: string;
  telnyxCredentialConnectionId?: string;
  telnyxMessagingProfileId?: string;
  telnyxCallControlApplicationId?: string;
}) {
  return apiFetch<{ settings: PlatformSettings }>('/api/admin/platform-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getAdminOrders(params?: { status?: string; paymentMethod?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.paymentMethod) q.set('paymentMethod', params.paymentMethod);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{ orders: NumberOrder[] }>(`/api/admin/orders${suffix}`);
}

export async function getAdminOrder(id: string) {
  return apiFetch<{
    order: NumberOrder;
    invoice: InvoicePreview;
    mailtoLink: string | null;
    tenantAdminEmail: string | null;
  }>(`/api/admin/orders/${id}`);
}

export async function markAdminOrderInvoiceSent(
  id: string,
  emailTo?: string,
  sendEmail?: boolean,
) {
  return apiFetch<{
    order: NumberOrder;
    emailResult?: { sent: boolean; reason?: string };
  }>(`/api/admin/orders/${id}/mark-invoice-sent`, {
    method: 'POST',
    body: JSON.stringify({ emailTo, sendEmail }),
  });
}

export async function fulfillAdminOrder(
  id: string,
  data?: { adminNotes?: string; paymentReference?: string },
) {
  return apiFetch<{
    message: string;
    purchased: Array<{ phoneNumber: string; message: string }>;
    failed: Array<{ phoneNumber: string; error: string }>;
    order: NumberOrder;
  }>(`/api/admin/orders/${id}/fulfill`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

export async function updateAdminOrder(
  id: string,
  data: { paymentReference?: string; adminNotes?: string },
) {
  return apiFetch<{ order: NumberOrder }>(`/api/admin/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type AdminRevenueReport = {
  summary: { totalRevenue: number; orderCount: number };
  byTenant: Array<{ tenantId: string; tenantName: string; revenue: number; orderCount: number }>;
  byMonth: Array<{ month: string; revenue: number; orderCount: number }>;
};

export async function getAdminRevenue() {
  return apiFetch<AdminRevenueReport>('/api/admin/revenue');
}

export type AdminAuditEntry = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export async function getAdminAuditLog(limit = 50) {
  return apiFetch<{ logs: AdminAuditEntry[] }>(`/api/admin/audit-log?limit=${limit}`);
}

export type TelnyxStatus = {
  apiKeyConfigured: boolean;
  connected: boolean;
  connectionId: string | null;
  connectionName: string;
  messagingProfileId: string | null;
  webhookUrl: string;
  statusCallbackUrl: string;
  smsWebhookUrl: string;
  voiceWebhookUrl: string;
  callRecordingWebhookUrl: string;
  message: string;
};

export async function getTelnyxStatus() {
  return apiFetch<{ status: TelnyxStatus }>('/api/admin/telnyx/status');
}

export async function cancelAdminOrder(id: string, adminNotes?: string) {
  return apiFetch<{ order: NumberOrder }>(`/api/admin/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ adminNotes }),
  });
}

export type VoiceQualityReport = {
  summary: {
    averageMos: number | null;
    callsLast24h: number;
    failedRate: number;
    avgDurationSeconds: number;
    activeConcurrent: number;
    answeredRate: number | null;
    averageMosSource?: string;
    averageMosSamples?: number;
    averageJitter?: number | null;
    packetLossRate?: number | null;
  };
  hourlyVolume: { hour: string; count: number }[];
  dailyVolume: { day: string; count: number }[];
  tenantBreakdown: {
    tenantId: string | null;
    tenantName: string;
    calls: number;
    failed: number;
    avgDurationSeconds: number;
    failedRate: number;
  }[];
  recentIssues: {
    callSid: string;
    from: string;
    to: string;
    status: string;
    tenantName: string;
    createdAt: string;
  }[];
  telemetrySamples?: {
    id: string;
    tenantName: string;
    from: string | null;
    to: string | null;
    mosInbound: number | null;
    mosOutbound: number | null;
    jitterMaxVariance: number | null;
    packetLoss: number | null;
    occurredAt: string;
  }[];
};

export async function getAdminVoiceQuality() {
  return apiFetch<{ report: VoiceQualityReport }>('/api/admin/voice-quality');
}

export type QuotaTenantRow = {
  id: string;
  name: string;
  isActive: boolean;
  userCount: number;
  numberCount: number;
  concurrentCalls: number;
  maxUsers: number;
  maxPhoneNumbers: number;
  maxConcurrentCalls: number;
  customMaxUsers: number | null;
  customMaxPhoneNumbers: number | null;
  customMaxConcurrentCalls: number | null;
  userUsagePercent: number;
  numberUsagePercent: number;
  concurrentUsagePercent: number;
  overLimit: boolean;
};

export type UsageTenantRow = QuotaTenantRow & {
  callsToday: number;
  smsToday: number;
  minutesUsedToday: number;
  currentPlan: string;
  monthlyCostEstimate: number;
};

export async function getAdminTenantUsage() {
  return apiFetch<{
    defaults: { maxUsers: number; maxPhoneNumbers: number; maxConcurrentCalls: number };
    tenants: UsageTenantRow[];
  }>('/api/admin/tenants/usage');
}

export type NumberInventoryRow = {
  id: string;
  number: string;
  label: string | null;
  status: 'ASSIGNED' | 'AVAILABLE' | 'PORTING' | 'RELEASED';
  isActive: boolean;
  tenantId: string;
  tenantName: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  monthlyCost: number | null;
  routingType: string;
  createdAt: string;
};

export type NumberInventorySummary = {
  purchased: number;
  assigned: number;
  available: number;
  availableSynced?: boolean;
  porting: number;
  released: number;
};

export async function getAdminNumberInventory(params?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.status) q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{
    summary: NumberInventorySummary;
    numbers: NumberInventoryRow[];
    total: number;
  }>(`/api/admin/numbers/inventory${suffix}`);
}

export async function releaseAdminNumber(id: string) {
  return apiFetch<{ success: boolean; number: { id: string; number: string } }>(
    `/api/admin/numbers/${id}/release`,
    { method: 'POST' },
  );
}

export async function getAdminQuotas() {
  return apiFetch<{
    defaults: { maxUsers: number; maxPhoneNumbers: number; maxConcurrentCalls: number };
    tenants: QuotaTenantRow[];
  }>('/api/admin/quotas');
}

export async function updateAdminQuotaDefaults(data: {
  defaultMaxUsers: number;
  defaultMaxPhoneNumbers: number;
  defaultMaxConcurrentCalls: number;
}) {
  return apiFetch<{
    defaults: { maxUsers: number; maxPhoneNumbers: number; maxConcurrentCalls: number };
    tenants: QuotaTenantRow[];
  }>('/api/admin/quotas/defaults', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateTenantQuotas(
  tenantId: string,
  data: {
    maxUsers?: number | null;
    maxPhoneNumbers?: number | null;
    maxConcurrentCalls?: number | null;
  },
) {
  return apiFetch<{ tenants: QuotaTenantRow[] }>(`/api/admin/tenants/${tenantId}/quotas`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type PortRequest = {
  id: string;
  tenantId: string;
  tenantName: string;
  phoneNumbers: string[];
  currentCarrier: string | null;
  billingTelephoneNumber: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  adminNotes: string | null;
  requestedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminPortRequests(status?: string) {
  const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<{ requests: PortRequest[] }>(`/api/admin/porting${query}`);
}

export async function createAdminPortRequest(data: {
  tenantId: string;
  phoneNumbers: string[];
  currentCarrier?: string;
  billingTelephoneNumber?: string;
  adminNotes?: string;
  requestedByEmail?: string;
}) {
  return apiFetch<{ request: PortRequest }>('/api/admin/porting', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminPortRequest(
  id: string,
  data: { status?: PortRequest['status']; adminNotes?: string; currentCarrier?: string },
) {
  return apiFetch<{ request: PortRequest }>(`/api/admin/porting/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type LcrConfig = {
  primaryConnectionId: string;
  fallbackConnectionId: string;
  notes: string;
  availableConnections: { id: string; label: string; type: string }[];
};

export async function getAdminLcr() {
  return apiFetch<{ lcr: LcrConfig }>('/api/admin/trunking/lcr');
}

export async function updateAdminLcr(data: {
  primaryConnectionId?: string;
  fallbackConnectionId?: string;
  notes?: string;
}) {
  return apiFetch<{ lcr: LcrConfig }>('/api/admin/trunking/lcr', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type SecurityReport = {
  roleCounts: Record<string, number>;
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    tenantName: string;
    createdAt: string;
  }[];
  tenantCompliance: {
    tenantId: string;
    tenantName: string;
    isActive: boolean;
    userCount: number;
    numberCount: number;
    checks: {
      callRecordingNotice: boolean;
      callRecordingEnabled: boolean;
      voicemailEnabled: boolean;
      businessHoursConfigured: boolean;
      hasRouting: boolean;
    };
    complianceScore: number;
  }[];
  summary: {
    totalUsers: number;
    superAdmins: number;
    tenantAdmins: number;
    tenantUsers: number;
    tenantsBelowCompliance: number;
  };
};

export async function getAdminSecurity() {
  return apiFetch<{ report: SecurityReport }>('/api/admin/security');
}

export type ExtensionStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type ExtensionDeviceRecord = {
  id: string;
  deviceType: 'WEBRTC' | 'MOBILE' | 'SIP';
  deviceName: string | null;
  platform: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'EXPIRED';
  lastRegistrationAt: string | null;
  extensionId?: string;
  extensionNumber?: string;
  displayName?: string;
};

export type DeviceRegistrationStatus = {
  status: 'ONLINE' | 'OFFLINE' | 'EXPIRED' | 'UNREGISTERED';
  lastSeen: string | null;
  deviceName: string | null;
  count?: number;
};

export type ExtensionOwnership = {
  employee: {
    userId: string | null;
    name: string;
    email: string | null;
    department: string | null;
  };
  primaryDid: { id: string; number: string; label: string | null } | null;
  assignedDidNumber: string | null;
  deviceRegistration: {
    mobile: DeviceRegistrationStatus;
    webrtc: DeviceRegistrationStatus;
    sip: DeviceRegistrationStatus;
  };
  lastSeen: string | null;
  inboundRecipient: {
    type: string;
    label: string;
    employeeName?: string;
    deviceCount?: number;
  };
};

export type ExtensionRecord = {
  id: string;
  extensionNumber: string;
  displayName: string;
  email: string | null;
  status: ExtensionStatus;
  department: string | null;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  primaryPhoneNumberId: string | null;
  ownership: ExtensionOwnership;
  employeeName: string;
  assignedDidNumber: string | null;
  deviceRegistration: ExtensionOwnership['deviceRegistration'];
  lastSeen: string | null;
  inboundRecipient: ExtensionOwnership['inboundRecipient'];
  lastActivityAt: string | null;
  createdAt: string;
  features: {
    voicemailEnabled: boolean;
    callRecordingEnabled: boolean;
    doNotDisturb: boolean;
    callScreeningEnabled: boolean;
    intercomEnabled: boolean;
  };
  registration: {
    webrtcEnabled: boolean;
    sipEnabled: boolean;
    multiDeviceEnabled: boolean;
    isLive: boolean;
    currentRegistration: {
      deviceType: string;
      deviceName: string | null;
      platform: string | null;
    } | null;
    lastRegistrationAt: string | null;
    connectedDeviceCount: number;
    totalDeviceCount: number;
    sipRegistered: boolean;
    softphoneOnlineAt: string | null;
  };
  deviceCount: number;
  registeredDeviceCount: number;
  devices: ExtensionDeviceRecord[];
  voicemailSettings: {
    enabled: boolean;
    greetingUrl: string | null;
    emailNotifications: boolean;
    notificationEmail: string | null;
  } | null;
  forwarding: ExtensionForwardingRules | null;
  dnd: ExtensionDndSettings | null;
  security: ExtensionSecuritySettings | null;
};

export type ExtensionSecuritySettings = {
  whitelist: { numbers: string[]; prefixes: string[]; allowInternalExtensions: boolean };
  blacklist: { numbers: string[]; patterns: string[]; blockAnonymous: boolean; blockSpamPatterns: boolean };
  blockAnonymous: boolean;
  spamPatternBlockEnabled: boolean;
  allowInternalExtensions: boolean;
  callerId: { outboundNumber: string | null; hideCallerId: boolean; displayName: string | null };
  callingPermissions: {
    local: boolean;
    national: boolean;
    international: boolean;
    premium: boolean;
    emergency: boolean;
  };
  timeRestrictions: {
    enabled: boolean;
    businessHours: Record<string, unknown>;
    afterHoursAction: 'BLOCK' | 'ALLOW' | 'VOICEMAIL_ONLY';
    holidaySchedule: unknown[];
  };
  recordingPolicy: 'ALWAYS' | 'INBOUND_ONLY' | 'OUTBOUND_ONLY' | 'ON_DEMAND' | 'DISABLED';
};

export type ExtensionAuditLog = {
  id: string;
  category: string;
  action: string;
  summary: string | null;
  changes?: unknown;
  userEmail: string | null;
  createdAt: string;
  extensionNumber?: string;
  displayName?: string;
};

export type ForwardDestinationType = 'EXTENSION' | 'RING_GROUP' | 'EXTERNAL_NUMBER';

export type ForwardRule = {
  enabled: boolean;
  destinationType: ForwardDestinationType | null;
  destination: string | null;
  destinationLabel?: string | null;
};

export type ExtensionForwardingRules = {
  always: ForwardRule;
  busy: ForwardRule;
  noAnswer: ForwardRule;
  schedule: ForwardRule & { rules?: Record<string, unknown> };
};

export type ExtensionDndSettings = {
  enabled: boolean;
  reason: string | null;
  scheduledEnabled: boolean;
  schedule: Record<string, unknown>;
  inboundAction: 'VOICEMAIL' | 'FORWARD';
};

export type ExtensionRegistrationRow = {
  extensionId: string;
  extensionNumber: string;
  displayName: string;
  status: 'ONLINE' | 'OFFLINE';
  lastRegistrationAt: string | null;
  deviceCount: number;
  connectedDeviceCount: number;
  doNotDisturb: boolean;
  callScreeningEnabled: boolean;
  intercomEnabled: boolean;
};

export type ExtensionAnalytics = {
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  voicemails: number;
  averageDurationSeconds: number;
};

export type ExtensionDashboardStats = {
  totalExtensions: number;
  onlineExtensions: number;
  offlineExtensions: number;
  voicemailCount: number;
  activeExtensions: number;
};

export async function getExtensionStats() {
  return apiFetch<{ success: boolean; stats: ExtensionDashboardStats }>('/api/tenant/extensions/stats');
}

export async function getExtensions() {
  return apiFetch<{ success: boolean; extensions: ExtensionRecord[] }>('/api/tenant/extensions');
}

export async function suggestExtensionNumber() {
  return apiFetch<{ success: boolean; extensionNumber: string }>('/api/tenant/extensions/suggest-number');
}

export async function getExtension(id: string) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(`/api/tenant/extensions/${id}`);
}

export async function getExtensionAnalytics(id: string) {
  return apiFetch<{ success: boolean; analytics: ExtensionAnalytics }>(`/api/tenant/extensions/${id}/analytics`);
}

export async function getExtensionVoicemails(id: string, limit = 50) {
  return apiFetch<{ success: boolean; voicemails: VoicemailRecord[] }>(
    `/api/tenant/extensions/${id}/voicemails?limit=${limit}`,
  );
}

export async function getExtensionDevices() {
  return apiFetch<{
    success: boolean;
    totalDevices: number;
    registeredDevices: number;
    devices: ExtensionDeviceRecord[];
    byType: { webrtc: number; mobile: number; sip: number };
  }>('/api/tenant/extensions/devices');
}

export async function createExtension(payload: {
  extensionNumber?: string;
  displayName: string;
  email?: string;
  department?: string;
  userId?: string;
  primaryPhoneNumberId?: string;
  voicemailEnabled?: boolean;
  callRecordingEnabled?: boolean;
  webrtcEnabled?: boolean;
  sipEnabled?: boolean;
  multiDeviceEnabled?: boolean;
}) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>('/api/tenant/extensions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateExtension(
  id: string,
  payload: Partial<{
    extensionNumber: string;
    displayName: string;
    email: string;
    department: string;
    userId: string | null;
    status: ExtensionStatus;
    voicemailEnabled: boolean;
    callRecordingEnabled: boolean;
    webrtcEnabled: boolean;
    sipEnabled: boolean;
    multiDeviceEnabled: boolean;
    voicemailSettings: {
      enabled: boolean;
      greetingUrl?: string | null;
      emailNotifications?: boolean;
      notificationEmail?: string | null;
    };
  }>,
) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(`/api/tenant/extensions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function disableExtension(id: string) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(`/api/tenant/extensions/${id}/disable`, {
    method: 'POST',
  });
}

export async function reassignExtensionEmployee(extensionId: string, userId: string) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(
    `/api/tenant/extensions/${extensionId}/reassign-employee`,
    { method: 'POST', body: JSON.stringify({ userId }) },
  );
}

export async function resetExtensionSipCredentials(extensionId: string) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord; result: { reset: boolean } }>(
    `/api/tenant/extensions/${extensionId}/reset-sip-credentials`,
    { method: 'POST' },
  );
}

export async function forceLogoutExtensionDevices(extensionId: string) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord; result: { loggedOut: boolean } }>(
    `/api/tenant/extensions/${extensionId}/force-logout-devices`,
    { method: 'POST' },
  );
}

export type ExtensionPhoneNumberRow = {
  id: string;
  number: string;
  label: string | null;
  routingType: string;
  isActive: boolean;
  isPrimary?: boolean;
};

export async function setExtensionPrimaryPhoneNumber(
  extensionId: string,
  phoneNumberId: string | null,
) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(
    `/api/tenant/extensions/${extensionId}/primary-phone-number`,
    { method: 'PATCH', body: JSON.stringify({ phoneNumberId }) },
  );
}

export async function getExtensionPhoneNumbers(extensionId: string) {
  return apiFetch<{
    success: boolean;
    primaryDid: ExtensionPhoneNumberRow | null;
    available: ExtensionPhoneNumberRow[];
    primaryPhoneNumberId: string | null;
  }>(`/api/tenant/extensions/${extensionId}/phone-numbers`);
}

export async function getAvailableExtensionDids() {
  return apiFetch<{ success: boolean; available: ExtensionPhoneNumberRow[] }>(
    '/api/tenant/extensions/available-dids',
  );
}

export type ExtensionSipCredentials = {
  sipUsername: string | null;
  sipPassword: string | null;
  sipServer: string;
  sipPort: number;
  sipPortTls: number;
  sipTransport: string;
  sipUri: string | null;
  outboundProxy: string;
  credentialId: string | null;
  credentialConnectionId: string | null;
  credentialConnectionName: string | null;
  voiceConnectionId: string | null;
  voiceConnectionName: string | null;
  loginToken: string | null;
  webrtcEnabled: boolean;
  sipEnabled: boolean;
  employeeName: string;
  employeeEmail: string | null;
  extensionNumber: string;
  displayName: string;
};

export async function getExtensionSipCredentials(extensionId: string) {
  return apiFetch<{ success: boolean; sip: ExtensionSipCredentials }>(
    `/api/tenant/extensions/${extensionId}/sip`,
  );
}

export type ExtensionProvisioningToken = {
  target: 'mobile' | 'sip_phone';
  token: string | null;
  expiresAt: string | null;
  expiresInSeconds: number | null;
  qrPayload: Record<string, unknown>;
  qrPayloadJson: string;
};

export async function createExtensionProvisioningToken(
  extensionId: string,
  target: 'mobile' | 'sip_phone' = 'mobile',
) {
  return apiFetch<{ success: boolean; provisioning: ExtensionProvisioningToken }>(
    `/api/tenant/extensions/${extensionId}/provisioning-token`,
    { method: 'POST', body: JSON.stringify({ target }) },
  );
}

export async function syncExtensionPhoneLinks() {
  return apiFetch<{ success: boolean; linked: number; extensions: number }>(
    '/api/tenant/extensions/sync-phone-links',
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export type OwnershipChainReport = {
  total: number;
  passing: number;
  failing: number;
  results: Array<{
    ok: boolean;
    issues: string[];
    phone: { id: string; number: string; routingType: string } | null;
    extension: { extensionNumber: string; primaryDid: string | null } | null;
    employee: { name: string; sipUsername: string | null } | null;
    inbound: { canRingEmployee: boolean; resolvesTo: string | null };
  }>;
};

export async function validateOwnershipChain() {
  return apiFetch<{ success: boolean; report: OwnershipChainReport }>(
    '/api/tenant/ownership/validate',
  );
}

export async function deleteExtension(id: string) {
  return apiFetch<{ success: boolean; deleted: boolean }>(`/api/tenant/extensions/${id}`, {
    method: 'DELETE',
  });
}

export async function getExtensionRegistration() {
  return apiFetch<{
    success: boolean;
    total: number;
    online: number;
    offline: number;
    extensions: ExtensionRegistrationRow[];
  }>('/api/tenant/extensions/registration');
}

export async function getExtensionDestinations() {
  return apiFetch<{
    success: boolean;
    extensions: Array<{ id: string; label: string; extensionNumber: string }>;
    ringGroups: Array<{ id: string; label: string }>;
  }>('/api/tenant/extensions/destinations');
}

export async function updateExtensionBusiness(
  id: string,
  payload: {
    doNotDisturb?: boolean;
    callScreeningEnabled?: boolean;
    intercomEnabled?: boolean;
    callRecordingEnabled?: boolean;
    voicemailEnabled?: boolean;
    dnd?: Partial<ExtensionDndSettings>;
    forwarding?: Partial<{
      always: Partial<ForwardRule>;
      busy: Partial<ForwardRule>;
      noAnswer: Partial<ForwardRule>;
      schedule: Partial<ForwardRule & { rules?: Record<string, unknown> }>;
    }>;
  },
) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord }>(`/api/tenant/extensions/${id}/business`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function initiateExtensionIntercom(id: string, targetExtensionNumber: string) {
  return apiFetch<{
    success: boolean;
    intercom: {
      mode: string;
      dialUri: string;
      message: string;
      target: { extensionNumber: string; displayName: string; sipUsername: string };
    };
  }>(`/api/tenant/extensions/${id}/intercom`, {
    method: 'POST',
    body: JSON.stringify({ targetExtensionNumber }),
  });
}

export async function updateExtensionSecurity(id: string, payload: Partial<ExtensionSecuritySettings>) {
  return apiFetch<{ success: boolean; extension: ExtensionRecord; security: ExtensionSecuritySettings }>(
    `/api/tenant/extensions/${id}/security`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function getExtensionAuditLogs(id: string, limit = 50, category?: string) {
  const q = category ? `&category=${category}` : '';
  return apiFetch<{ success: boolean; logs: ExtensionAuditLog[] }>(
    `/api/tenant/extensions/${id}/audit-logs?limit=${limit}${q}`,
  );
}

export async function getSecurityAuditLogs(limit = 50) {
  return apiFetch<{ success: boolean; logs: ExtensionAuditLog[] }>(
    `/api/tenant/extensions/security/audit?limit=${limit}`,
  );
}

export type RingStrategy = 'SIMULTANEOUS' | 'SEQUENTIAL' | 'ROUND_ROBIN' | 'LONGEST_IDLE';

export type RingGroupMember = {
  id: string;
  ringGroupId: string;
  extensionId: string;
  priority: number;
  isActive: boolean;
  lastAnsweredAt: string | null;
  lastRungAt: string | null;
  extension: {
    id: string;
    extensionNumber: string;
    displayName: string;
    status: string;
    user: {
      id: string;
      name: string;
      email: string;
      hasSipCredential: boolean;
      sipRegistered: boolean | null;
    } | null;
  } | null;
};

export type RingGroupAnalytics = {
  callsOffered: number;
  callsAnswered: number;
  callsMissed: number;
  averageAnswerTimeSeconds: number;
  answerRatePercent?: number;
};

export type RingGroupRecord = {
  id: string;
  tenantId: string;
  name: string;
  extensionNumber: string | null;
  ringStrategy: RingStrategy;
  ringTimeoutSeconds: number;
  roundRobinPointer: number;
  voicemailEnabled: boolean;
  voicemailGreetingUrl: string | null;
  callRecordingEnabled: boolean;
  isActive: boolean;
  memberCount: number;
  voicemailCount: number;
  phoneNumbers: { id: string; number: string; label: string | null }[];
  analytics: RingGroupAnalytics;
  members?: RingGroupMember[];
  createdAt: string;
  updatedAt: string;
};

export async function getRingGroups() {
  return apiFetch<{ success: boolean; ringGroups: RingGroupRecord[] }>('/api/tenant/ring-groups');
}

export async function getRingGroup(id: string) {
  return apiFetch<{ success: boolean; ringGroup: RingGroupRecord }>(`/api/tenant/ring-groups/${id}`);
}

export async function createRingGroup(payload: {
  name: string;
  extensionNumber?: string | null;
  ringStrategy?: RingStrategy;
  ringTimeoutSeconds?: number;
  voicemailEnabled?: boolean;
  callRecordingEnabled?: boolean;
}) {
  return apiFetch<{ success: boolean; ringGroup: RingGroupRecord }>('/api/tenant/ring-groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRingGroup(
  id: string,
  payload: Partial<{
    name: string;
    extensionNumber: string | null;
    ringStrategy: RingStrategy;
    ringTimeoutSeconds: number;
    voicemailEnabled: boolean;
    callRecordingEnabled: boolean;
    isActive: boolean;
  }>,
) {
  return apiFetch<{ success: boolean; ringGroup: RingGroupRecord }>(`/api/tenant/ring-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteRingGroup(id: string) {
  return apiFetch<{ success: boolean; deleted: boolean }>(`/api/tenant/ring-groups/${id}`, {
    method: 'DELETE',
  });
}

export async function addRingGroupMember(ringGroupId: string, extensionId: string, priority?: number) {
  return apiFetch<{ success: boolean; member: RingGroupMember }>(
    `/api/tenant/ring-groups/${ringGroupId}/members`,
    { method: 'POST', body: JSON.stringify({ extensionId, priority }) },
  );
}

export async function removeRingGroupMember(ringGroupId: string, memberId: string) {
  return apiFetch<{ success: boolean; removed: boolean }>(
    `/api/tenant/ring-groups/${ringGroupId}/members/${memberId}`,
    { method: 'DELETE' },
  );
}

export async function getRingGroupAnalytics(id: string) {
  return apiFetch<{ success: boolean; analytics: RingGroupAnalytics }>(
    `/api/tenant/ring-groups/${id}/analytics`,
  );
}

export async function getRingGroupVoicemails(id: string, limit = 50) {
  return apiFetch<{ success: boolean; voicemails: VoicemailRecord[] }>(
    `/api/tenant/ring-groups/${id}/voicemails?limit=${limit}`,
  );
}

export async function getRingGroupRoutingPreview(id: string) {
  return apiFetch<{
    success: boolean;
    preview: {
      targetCount: number;
      strategy: string;
      ringTimeout: number;
      targets: { type: string; label: string; extensionId?: string; sipUsername: string | null }[];
    };
  }>(`/api/tenant/ring-groups/${id}/routing-preview`);
}
