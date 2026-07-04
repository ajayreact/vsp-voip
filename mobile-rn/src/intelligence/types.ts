import type { CallLogEntry, VoicemailRecord } from '../api/types';
import type { PlatformConversation } from '../messaging/types';
import type { AiSummaryEntityType, AiSummaryResponse } from '../ai/types';

export type IntelligenceRecommendationKind =
  | 'callback_waiting'
  | 'unanswered_message'
  | 'urgent_voicemail'
  | 'follow_up_reminder'
  | 'sales_opportunity'
  | 'missed_customer'
  | 'priority_customer';

export type IntelligenceRecommendation = {
  id: string;
  kind: IntelligenceRecommendationKind;
  title: string;
  subtitle: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  deepLink?: {
    tab: 'Recent' | 'Text' | 'You' | 'Contacts' | 'AI';
    screen?: string;
    params?: Record<string, unknown>;
  };
};

export type DailyBriefMetrics = {
  todaysCalls: number;
  missedCalls: number;
  unreadMessages: number;
  voicemails: number;
  urgentConversations: number;
  pendingFollowUps: number;
  highPriorityCustomers: number;
  upcomingCallbacks: number;
};

export type DailyBriefInsight = {
  id: string;
  entityType: AiSummaryEntityType;
  entityId: string;
  title: string;
  summary: string;
  priority?: string;
  generatedAt?: string;
};

export type DailyBrief = {
  metrics: DailyBriefMetrics;
  recentInsights: DailyBriefInsight[];
  generatedAt: string;
};

export type BusinessInsights = {
  todaysActivity: number;
  weeklyActivity: number;
  callVolumeToday: number;
  callVolumeWeek: number;
  messageVolumeToday: number;
  messageVolumeWeek: number;
  voicemailVolumeToday: number;
  voicemailVolumeWeek: number;
  followUpCompletionRate: number | null;
  averageResponseMinutes: number | null;
  trends: {
    calls: 'up' | 'down' | 'flat';
    messages: 'up' | 'down' | 'flat';
    voicemails: 'up' | 'down' | 'flat';
  };
};

export type SmartBanner = {
  id: string;
  message: string;
  priority: 'high' | 'medium';
  recommendationId?: string;
};

export type CustomerTimelineItemKind = 'call' | 'message' | 'voicemail' | 'insight' | 'follow_up' | 'recommendation';

export type CustomerTimelineItem = {
  id: string;
  kind: CustomerTimelineItemKind;
  title: string;
  subtitle: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

export type CustomerTimeline = {
  items: CustomerTimelineItem[];
  latestFollowUp: string | null;
  recommendedNextAction: string | null;
};

export type IntelligenceInput = {
  calls: CallLogEntry[];
  voicemails: VoicemailRecord[];
  conversations: PlatformConversation[];
  cachedSummaries: Array<{
    entityType: AiSummaryEntityType;
    entityId: string;
    response: AiSummaryResponse;
  }>;
  dashboardStats?: {
    callCount?: number;
    unreadSmsCount?: number;
    unreadVoicemailCount?: number;
  };
  now?: Date;
};
