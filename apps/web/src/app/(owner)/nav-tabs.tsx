'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Properties', ownerOnly: false },
  { href: '/staff', label: 'Staff', ownerOnly: false },
] as const;

export function NavTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="mx-auto max-w-5xl px-4">
      <ul className="flex gap-1">
        {TABS.filter((tab) => isOwner || !tab.ownerOnly).map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ' +
                  (active
                    ? 'border-teal-600 text-teal-700 dark:text-teal-100'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]')
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
