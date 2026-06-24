'use client';

import {
  CircleEllipsis,
  Clock3,
  Grid3X3,
  Users,
  Voicemail,
} from 'lucide-react';
import type { PhoneTab } from '@/components/softphone-v2/types';
import { cn } from '@/lib/utils';

const TABS: Array<{ id: PhoneTab; label: string; icon: typeof Voicemail }> = [
  { id: 'voicemail', label: 'Voicemail', icon: Voicemail },
  { id: 'recents', label: 'Recents', icon: Clock3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'keypad', label: 'Keypad', icon: Grid3X3 },
  { id: 'more', label: 'More', icon: CircleEllipsis },
];

type BottomTabBarProps = {
  activeTab: PhoneTab;
  onTabChange: (tab: PhoneTab) => void;
  voicemailBadge?: number;
};

export function BottomTabBar({ activeTab, onTabChange, voicemailBadge = 0 }: BottomTabBarProps) {
  return (
    <nav className="shrink-0 border-t border-black/[0.06] bg-white/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onTabChange(id)}
                className={cn(
                  'relative flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-colors',
                  active ? 'text-[#007AFF]' : 'text-[#8E8E93]',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 2} />
                <span className="text-[10px] font-medium">{label}</span>
                {id === 'voicemail' && voicemailBadge > 0 ? (
                  <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[10px] font-bold text-white">
                    {voicemailBadge > 9 ? '9+' : voicemailBadge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
