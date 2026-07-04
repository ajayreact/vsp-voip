import React from 'react';
import { AuthenticatedSyncProviders } from '../providers/AuthenticatedSyncProviders';

type Props = {
  children: React.ReactNode;
};

/** Loads Telnyx native SDK only after the user is signed in. */
export function AuthenticatedCallShell({ children }: Props) {
  const { TelnyxCallingProvider } = require('../calling/TelnyxCallingProvider') as typeof import('../calling/TelnyxCallingProvider');

  return (
    <TelnyxCallingProvider>
      <AuthenticatedSyncProviders>{children}</AuthenticatedSyncProviders>
    </TelnyxCallingProvider>
  );
}

function AuthenticatedCallOverlay() {
  const { CallOverlay } = require('../calling/CallOverlay') as typeof import('../calling/CallOverlay');
  return <CallOverlay />;
}

export function LazyCallOverlay() {
  return <AuthenticatedCallOverlay />;
}
