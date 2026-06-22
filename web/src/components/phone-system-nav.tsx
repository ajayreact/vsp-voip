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
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn('filter-btn', active && 'filter-btn-active')}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
