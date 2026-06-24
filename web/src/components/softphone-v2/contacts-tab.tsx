'use client';

import { Phone, Search } from 'lucide-react';
import type { ContactEntry } from '@/components/softphone-v2/types';
import { callerInitials } from '@/components/softphone-v2/utils';

type ContactsTabProps = {
  contacts: ContactEntry[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (contact: ContactEntry) => void;
};

export function ContactsTab({
  contacts,
  loading,
  search,
  onSearchChange,
  onSelect,
}: ContactsTabProps) {
  const query = search.trim().toLowerCase();
  const filtered = contacts.filter((contact) => {
    if (!query) return true;
    return (
      contact.name.toLowerCase().includes(query)
      || contact.extensionNumber.includes(query)
      || contact.department.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pb-3 pt-2">
        <h1 className="text-[34px] font-bold tracking-tight text-[#1D1D1F]">Contacts</h1>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl bg-[#E5E5EA]/80 py-2.5 pl-10 pr-4 text-base text-[#1D1D1F] outline-none placeholder:text-[#8E8E93]"
          />
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <li className="px-4 py-16 text-center text-sm text-[#8E8E93]">Loading contacts…</li>
        ) : filtered.length === 0 ? (
          <li className="px-4 py-16 text-center text-sm text-[#8E8E93]">
            No contacts yet — extensions will appear here for future CRM integration.
          </li>
        ) : (
          filtered.map((contact) => (
            <li key={contact.id} className="border-b border-[#E5E5EA] last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(contact)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/70"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#007AFF]/10 text-sm font-semibold text-[#007AFF]">
                  {callerInitials(contact.name || contact.extensionNumber)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-[#1D1D1F]">{contact.name}</p>
                  <p className="mt-0.5 text-sm text-[#8E8E93]">
                    Ext {contact.extensionNumber}
                    {contact.department ? ` · ${contact.department}` : ''}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34C759]/10 text-[#34C759]">
                  <Phone className="h-4 w-4" />
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
