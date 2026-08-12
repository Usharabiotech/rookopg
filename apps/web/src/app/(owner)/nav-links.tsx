'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Properties' },
  { href: '/staff', label: 'Staff' },
] as const;

export function NavLinks({
  variant,
  showStaff,
}: {
  variant: 'rail' | 'tabs';
  showStaff: boolean;
}) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => link.href !== '/staff' || showStaff);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (variant === 'rail') {
    return (
      <ul className="space-y-1">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={
                  'pressable flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium ' +
                  (active
                    ? 'bg-white/10 text-white'
                    : 'text-[var(--rail-text)] hover:bg-white/5 hover:text-white')
                }
              >
                {/* A thin brass marker rather than a filled pill — quieter, and
                    it reads as a tab on a filing cabinet. */}
                <span
                  aria-hidden="true"
                  className={
                    'h-4 w-0.5 rounded-full ' + (active ? 'bg-brass-500' : 'bg-transparent')
                  }
                />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex gap-1">
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={
                'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ' +
                (active
                  ? 'border-brass-500 text-[var(--text)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]')
              }
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
