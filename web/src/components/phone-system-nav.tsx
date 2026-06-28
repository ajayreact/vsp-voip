'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/phone-system/extensions', label: 'Extensions' },
  { href: '/phone-system/ring-groups', label: 'Ring groups' },
  { href: '/phone-system/registration', label: 'Registration' },
  { href: '/phone-system/devices', label: 'Devices' },
  { href: '/phone-system/voicemail', label: 'Voicemail' },
  { href: '/phone-system/call-routing', label: 'Call routing' },
  { href: '/phone-system/security', label: 'Security' },
];

export function PhoneSystemNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto border-b border-slate-200 px-4 pb-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn('filter-btn shrink-0 whitespace-nowrap', active && 'filter-btn-active')}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
