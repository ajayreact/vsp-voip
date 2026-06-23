'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import Link from 'next/link';
import { getSoftphoneHref, isSoftphoneV2Enabled } from '@/lib/softphone-config';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class SoftphoneV2ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[softphone-v2] uncaught error', error, info.componentStack);
  }

  private onRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const legacyHref = '/softphone';
      const showLegacyLink = isSoftphoneV2Enabled();

      return (
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="rounded-3xl border border-red-200/80 bg-red-50/90 px-6 py-8 shadow-lg dark:border-red-500/30 dark:bg-red-950/40">
            <p className="text-lg font-semibold text-red-800 dark:text-red-200">
              Softphone encountered an error
            </p>
            <p className="mt-2 text-sm text-red-700/80 dark:text-red-200/70">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.onRetry}
                className="rounded-full bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
              >
                Try again
              </button>
              <Link
                href={getSoftphoneHref()}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/20 dark:text-white"
              >
                Reload softphone
              </Link>
              {showLegacyLink ? (
                <Link
                  href={legacyHref}
                  className="rounded-full border border-amber-300 px-5 py-2.5 text-sm font-semibold text-amber-800 dark:border-amber-500/40 dark:text-amber-200"
                >
                  Open legacy softphone
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
