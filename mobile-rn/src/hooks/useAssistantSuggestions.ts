import { useQuery } from '@tanstack/react-query';
import { fetchAssistantSuggestions } from '../ai/assistantService';
import { SYNC_PROFILES } from '../lib/syncProfiles';

const DEFAULT_PROMPTS = [
  "Show today's missed calls",
  'Summarize my day',
  "Find John's voicemail",
  'Show unread SMS',
  'Customers needing follow-up',
  'Find invoice 2048',
  'Recent urgent conversations',
];

export function assistantSuggestionsQueryKey() {
  return ['assistant', 'suggestions'] as const;
}

export function useAssistantSuggestions() {
  const query = useQuery({
    queryKey: assistantSuggestionsQueryKey(),
    queryFn: fetchAssistantSuggestions,
    staleTime: SYNC_PROFILES.assistantSuggestionsStaleMs,
    gcTime: 30 * 60_000,
  });

  const suggestions =
    query.data && query.data.length > 0 ? query.data.slice(0, 7) : DEFAULT_PROMPTS;

  return { ...query, suggestions };
}
