import Link from 'next/link';
import { cookies } from 'next/headers';
import { ThemeToggle, type Theme } from '@/components/theme-toggle';

async function readTheme(): Promise<Theme> {
  const value = (await cookies()).get('pg_theme')?.value;
  return value === 'dark' || value === 'light' ? value : 'system';
}

async function isSignedIn(): Promise<boolean> {
  return (await cookies()).get('pg_rt') !== undefined;
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [theme, signedIn] = await Promise.all([readTheme(), isSignedIn()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="figure inline-flex size-8 items-center justify-center rounded-md bg-brass-500 text-[13px] font-semibold text-ink-950"
            >
              PG
            </span>
            <span className="display text-[15px] leading-none">PG Platform</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle initial={theme} variant="bar" />
            {/*
              Owners sign in; tenants browse. Sending an owner to their
              dashboard rather than a login form saves the one tap they make
              most often.
            */}
            <Link
              href={signedIn ? '/dashboard' : '/login'}
              className="pressable inline-flex min-h-11 items-center rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium hover:bg-[var(--bg-deep)]"
            >
              {signedIn ? 'My PGs' : 'List your PG'}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-[var(--text-muted)] sm:px-6">
          <p>PG and hostel accommodation in Hyderabad.</p>
          <p className="mt-1 text-xs">
            Own a PG?{' '}
            <Link href="/login" className="underline hover:text-[var(--text)]">
              List it free
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
