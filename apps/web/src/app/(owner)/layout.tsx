import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import { signOutAction } from './actions';
import { NavTabs } from './nav-tabs';

async function loadUser(): Promise<AuthUser> {
  try {
    return await api<AuthUser>('/auth/me');
  } catch (error) {
    if (isApiError(error) && error.isUnauthenticated) redirect('/login');
    throw error;
  }
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await loadUser();
  const org = user.memberships[0];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold text-white">
              PG
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">
                {org?.orgName ?? 'PG Platform'}
              </span>
              {org ? (
                <span className="block text-xs capitalize text-[var(--text-muted)]">
                  {org.role.toLowerCase()}
                </span>
              ) : null}
            </span>
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Sign out
            </button>
          </form>
        </div>

        {org ? <NavTabs isOwner={org.role === 'OWNER'} /> : null}
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-5 sm:py-7">
        {children}
      </main>
    </div>
  );
}
