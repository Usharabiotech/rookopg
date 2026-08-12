import { redirect } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import { signOutAction } from './actions';
import { NavLinks } from './nav-links';

async function loadUser(): Promise<AuthUser> {
  try {
    return await api<AuthUser>('/auth/me');
  } catch (error) {
    if (isApiError(error) && error.isUnauthenticated) redirect('/login');
    throw error;
  }
}

function Wordmark({ onRail }: { onRail?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="figure inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brass-500 text-[13px] font-semibold text-ink-950"
      >
        PG
      </span>
      <span
        className={`display text-[15px] leading-none ${onRail ? 'text-white' : 'text-[var(--text)]'}`}
      >
        PG Platform
      </span>
    </span>
  );
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await loadUser();
  const org = user.memberships[0];
  const isOwner = org?.role === 'OWNER';

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/*
        Desktop rail. A dashboard that lives on one screen all day wants its
        navigation parked, not floating above the content.
      */}
      <aside className="hidden bg-[var(--rail)] lg:flex lg:flex-col lg:justify-between lg:p-5">
        <div>
          <a href="/" className="block">
            <Wordmark onRail />
          </a>

          {org ? (
            <>
              <div className="mt-8">
                <p className="eyebrow text-ink-400">Business</p>
                <p className="mt-1.5 truncate font-medium text-white">{org.orgName}</p>
                <p className="mt-0.5 text-xs capitalize text-ink-400">{org.role.toLowerCase()}</p>
              </div>
              <nav aria-label="Sections" className="mt-8">
                <NavLinks variant="rail" showStaff={Boolean(org)} />
              </nav>
            </>
          ) : null}
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="pressable min-h-11 w-full rounded-lg px-3 text-left text-sm text-ink-400 hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile bar. The rail collapses to this below lg. */}
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <a href="/" className="min-w-0">
              {org ? (
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="figure inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-brass-500 text-[13px] font-semibold text-ink-950"
                  >
                    PG
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">
                      {org.orgName}
                    </span>
                    <span className="block text-xs capitalize text-[var(--text-muted)]">
                      {org.role.toLowerCase()}
                    </span>
                  </span>
                </span>
              ) : (
                <Wordmark />
              )}
            </a>

            <form action={signOutAction}>
              <button
                type="submit"
                className="min-h-11 rounded-lg px-3 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Sign out
              </button>
            </form>
          </div>

          {org ? (
            <nav aria-label="Sections" className="px-4">
              <NavLinks variant="tabs" showStaff={isOwner || true} />
            </nav>
          ) : null}
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
