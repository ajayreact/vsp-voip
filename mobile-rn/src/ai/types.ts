export type AiSummaryEntityType = 'voicemail' | 'call' | 'conversation';

export type AiSummaryResult = {
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  priority?: string;
  sentiment?: string;
  confidence?: number;
  generatedAt?: string;
  provider?: string;
  model?: string;
  callbackRecommendation?: string;
  executiveSummary?: string;
  discussionTopics?: string[];
  customerIntent?: string;
  followUpTasks?: string[];
  salesOpportunity?: string;
  conversationSummary?: string;
  outstandingQuestions?: string[];
  unreadRequests?: string[];
  latestDecision?: string;
};

export type AiSummaryRecord = {
  id?: string;
  status: string;
  result?: AiSummaryResult | null;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  generatedAt?: string | null;
};

export type AiSummaryResponse = {
  success?: boolean;
  status: string;
  reason?: string;
  summary?: AiSummaryRecord | null;
};

export type AiSummaryGenerateResponse = {
  success?: boolean;
  queued?: boolean;
  summary?: AiSummaryRecord;
};
