import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createOptimisticId,
  createOutboxId,
  useOutboxStore,
} from '../messaging/outboxStore';
import {
  conversationFromOutboundMessage,
  patchThreadMessage,
  reconcileOptimisticThreadMessage,
  upsertConversationSummary,
  upsertThreadMessage,
} from '../messaging/messagingQueryCache';
import { sendPlatformMessage, uploadMessageAttachment } from '../messaging/messagingService';
import type { MessageAttachment, PlatformMessage } from '../messaging/types';
import type { AttachmentUploadInput } from '../messaging/types';

type SendParams = {
  from: string;
  to: string;
  text: string;
  conversationId?: string;
  pendingUploads?: AttachmentUploadInput[];
  uploadedAttachments?: MessageAttachment[];
  outboxId?: string;
  optimisticId?: string;
};

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendParams) => {
      const uploaded = [...(params.uploadedAttachments ?? [])];
      for (const file of params.pendingUploads ?? []) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      return sendPlatformMessage({
        from: params.from,
        to: params.to,
        text: params.text,
        attachmentIds: uploaded.map((item) => item.id),
      });
    },
    onSuccess: (res, params) => {
      const conversationId = params.conversationId || res.message.conversationId;
      const serverMessage = { ...res.message, _optimistic: false, _outboxId: params.outboxId };

      if (params.optimisticId) {
        reconcileOptimisticThreadMessage(
          queryClient,
          conversationId,
          params.optimisticId,
          serverMessage,
        );
      } else {
        upsertThreadMessage(queryClient, conversationId, serverMessage);
      }

      upsertConversationSummary(
        queryClient,
        conversationFromOutboundMessage(serverMessage, params.to, params.from),
      );
    },
    onError: (error, params) => {
      if (params.optimisticId && params.conversationId) {
        patchThreadMessage(queryClient, params.conversationId, params.optimisticId, {
          status: 'failed',
          deliveryError: error instanceof Error ? error.message : 'Send failed',
          _optimistic: false,
        });
      }

      const outboxId = params.outboxId || createOutboxId();
      useOutboxStore.getState().enqueue({
        id: outboxId,
        from: params.from,
        to: params.to,
        text: params.text,
        attachmentIds: (params.uploadedAttachments ?? []).map((item) => item.id),
        attachments: params.uploadedAttachments ?? [],
        conversationId: params.conversationId,
        lastError: error instanceof Error ? error.message : 'Send failed',
      });
    },
  });
}

export function buildOptimisticMessage(params: {
  conversationId?: string;
  from: string;
  to: string;
  text: string;
  attachments?: MessageAttachment[];
  outboxId?: string;
}): PlatformMessage {
  return {
    id: createOptimisticId(),
    conversationId: params.conversationId || 'pending',
    from: params.from,
    to: params.to,
    body: params.text,
    direction: 'OUTBOUND',
    messageType: params.attachments?.length ? 'MMS' : 'SMS',
    status: 'sending',
    createdAt: new Date().toISOString(),
    attachments: params.attachments,
    _optimistic: true,
    _outboxId: params.outboxId,
  };
}
