'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtensionDrawerTab } from '@/components/extension-detail-drawer';

const TABS: { id: ExtensionDrawerTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'employee', label: 'Employee & Devices' },
  { id: 'sip', label: 'Config' },
  { id: 'qr', label: 'QR Provisioning' },
  { id: 'security', label: 'Security' },
  { id: 'analytics', label: 'Analytics' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  activeTab: ExtensionDrawerTab;
  onTabChange: (tab: ExtensionDrawerTab) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ExtensionDetailDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  activeTab,
  onTabChange,
  children,
  footer,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close extension panel"
      />
      <div className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl">
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition',
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 bg-white px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
