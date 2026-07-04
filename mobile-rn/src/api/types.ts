export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  tenantName?: string | null;
  tenantContactEmail?: string | null;
  tenantTimezone?: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
};

export type LoginResponse = {
  success: boolean;
  accessToken: string;
  refreshToken?: string;
  user: User;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

export type MeResponse = User;

export type CallLogEntry = {
  id: string;
  callSid?: string;
  from: string;
  to: string;
  direction?: string;
  status: string;
  callType?: string | null;
  durationSeconds?: number | null;
  durationLabel?: string;
  createdAt: string;
  endedAt?: string | null;
  tenant?: { name: string };
};

export type NumberOrder = {
  id: string;
  status: string;
  createdAt: string;
  totalAmount?: number;
  currency?: string;
};

export type DashboardStats = {
  success?: boolean;
  callCount?: number;
  numberCount?: number;
  unreadVoicemailCount?: number;
  unreadSmsCount?: number;
  pendingOrdersCount?: number;
  recentOrders?: NumberOrder[];
  recentCalls?: CallLogEntry[];
};

export type ExtensionStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type ExtensionRecord = {
  id: string;
  extensionNumber: string;
  displayName: string;
  email: string | null;
  status: ExtensionStatus;
  department: string | null;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  employeeName: string;
  assignedDidNumber: string | null;
  lastSeen: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  features?: {
    voicemailEnabled: boolean;
    callRecordingEnabled: boolean;
    doNotDisturb: boolean;
  };
  registration?: {
    isLive?: boolean;
    softphoneOnlineAt?: string | null;
  };
};

export type TenantProfile = {
  id: string;
  name: string;
  contactEmail: string;
  timezone: string;
};

export type ApiErrorBody = {
  error?: string;
};

export type ContactEntry = {
  id: string;
  name: string;
  extensionNumber: string;
  department: string;
  email: string | null;
  assignedDidNumber: string | null;
  status: ExtensionStatus;
  isOnline: boolean;
};

export type MessageAttachment = {
  id: string;
  messageId?: string;
  fileName?: string;
  mimeType?: string;
  url?: string;
  sizeBytes?: number;
};

export type MessageRecord = {
  id: string;
  conversationId?: string;
  from?: string;
  to?: string;
  body?: string;
  direction?: 'inbound' | 'outbound' | 'INBOUND' | 'OUTBOUND';
  messageType?: string;
  status?: string;
  createdAt?: string;
  attachments?: MessageAttachment[];
};

export type ConversationSummary = {
  id: string;
  peer?: string;
  line?: string;
  peerNumber?: string;
  lineNumber?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  type?: string;
};

export type VoicemailRecord = {
  id: string;
  from: string;
  to: string;
  durationSeconds: number | null;
  isRead: boolean;
  recordingUrl?: string | null;
  createdAt: string;
};
