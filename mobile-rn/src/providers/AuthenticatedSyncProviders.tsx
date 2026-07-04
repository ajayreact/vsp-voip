import React from 'react';
import { MessagingSyncProvider } from '../messaging/MessagingSyncProvider';
import { VoicemailSyncProvider } from '../voicemail/VoicemailSyncProvider';

/** Messaging and voicemail sync — mounted only after the user is signed in. */
export function AuthenticatedSyncProviders({ children }: { children: React.ReactNode }) {
  return (
    <MessagingSyncProvider>
      <VoicemailSyncProvider>{children}</VoicemailSyncProvider>
    </MessagingSyncProvider>
  );
}
