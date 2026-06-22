'use client';

import type { ReactNode } from 'react';
import { SwitchField } from '@/components/switch-field';
import { GatewayStatusBadge, getGatewayStatus } from '@/components/gateway-status-badge';

export type PaymentGatewayCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  enabled: boolean;
  mode?: 'test' | 'live' | null;
  loading?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children?: ReactNode;
};

export function PaymentGatewayCard({
  title,
  description,
  icon,
  enabled,
  mode,
  loading,
  onEnabledChange,
  children,
}: PaymentGatewayCardProps) {
  const status = getGatewayStatus(enabled, mode);

  return (
    <div className="panel-card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <span className="mt-0.5 shrink-0 text-indigo-600">{icon}</span> : null}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-slate-900">{title}</h3>
                <GatewayStatusBadge status={status} />
              </div>
              {description ? (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <SwitchField
          label="Enabled at checkout"
          description={
            enabled
              ? 'Visible to customers during checkout.'
              : 'Hidden from customers until enabled.'
          }
          checked={enabled}
          onCheckedChange={onEnabledChange}
          loading={loading}
        />
        {children}
      </div>
    </div>
  );
}

export function GatewayFeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: { type: 'success' | 'error'; message: string } | null;
  onDismiss?: () => void;
}) {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div
      role="status"
      className={
        isSuccess
          ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
          : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span>{feedback.message}</span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
