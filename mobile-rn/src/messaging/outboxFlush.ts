import { useOutboxStore } from '../messaging/outboxStore';
import { sendPlatformMessage } from '../messaging/messagingService';
import { logger, withRetry } from '../lib/logger';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import type { QueryClient } from '@tanstack/react-query';

let flushPromise: Promise<void> | null = null;
export const MAX_OUTBOX_RETRIES = 12;

export async function flushMessagingOutbox(queryClient: QueryClient) {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const snapshot = [...useOutboxStore.getState().items];
    for (const item of snapshot) {
      if (item.retryCount >= MAX_OUTBOX_RETRIES) {
        logger.telemetry('outbox_flush_failed', {
          outboxId: item.id,
          retries: item.retryCount,
          reason: 'max_retries',
        });
        continue;
      }
      const stillQueued = useOutboxStore.getState().items.some((entry) => entry.id === item.id);
      if (!stillQueued) continue;

      try {
        await withRetry(
          () =>
            sendPlatformMessage({
              from: item.from,
              to: item.to,
              text: item.text,
              attachmentIds: item.attachmentIds,
            }),
          { label: 'outbox-send', attempts: 2 },
        );
        useOutboxStore.getState().remove(item.id);
      } catch (error) {
        const friendly = getFriendlyErrorMessage(error, 'messages');
        useOutboxStore.getState().markRetry(item.id, friendly);
        if (item.retryCount + 1 >= MAX_OUTBOX_RETRIES) {
          logger.telemetry('outbox_flush_failed', {
            outboxId: item.id,
            retries: item.retryCount + 1,
            reason: friendly,
          });
        }
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['messaging'] });
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}
