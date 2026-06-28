export {
  fetchConversations,
  fetchConversationMessages,
  markConversationRead,
  sendPlatformMessage,
  uploadMessageAttachment,
  fetchMessagingSetup,
} from './messagingService';
export type {
  MessageAttachment,
  PlatformConversation,
  PlatformMessage,
  MessagingLine,
  MessagingSetup,
  AttachmentUploadInput,
} from './types';
