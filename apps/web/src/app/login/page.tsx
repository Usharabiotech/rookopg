import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params['next']) ? params['next'][0] : params['next'];
  // Only same-site paths: an open redirect here would let someone send a
  // tenant to a lookalike page after a genuine sign-in.
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;

  if (await isSignedIn()) redirect((next ?? '/dashboard') as never);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/*
        Left panel is the product's own artifact — a rack of key tags, some
        hanging and some off the hook. It says what this tool is for before a
        word is read, and fills the desktop width with something true rather
        than a stock photograph.
      */}
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="figure inline-flex size-8 items-center justify-center rounded-md bg-brass-500 text-[13px] font-semibold text-ink-950"
          >
            PG
          </span>
          <span className="display text-[15px] text-white">PG Platform</span>
        </span>

        <div>
          <div className="rack mb-10 flex flex-wrap gap-2" aria-hidden="true">
            {[
              '101', '102', '103', '104', '105', '106',
              '201', '202', '203', '204', '205', '206',
              '301', '302',
            ].map((code, index) => {
              const taken = index % 3 === 0;
              return (
                <span
                  key={code}
                  className={
                    'figure relative inline-flex h-12 w-11 items-end justify-center rounded-md border pb-2 text-xs font-semibold ' +
                    (taken
                      ? 'border-brass-600 bg-brass-500 text-ink-950'
                      : 'border-ink-700 bg-ink-900 text-ink-400')
                  }
                >
                  <span
                    className={
                      'absolute left-1/2 top-2 size-1.5 -translate-x-1/2 rounded-full ' +
                      (taken ? 'bg-ink-950/40' : 'bg-ink-700')
                    }
                  />
                  {code}
                </span>
              );
            })}
          </div>

          <h2 className="display max-w-sm text-3xl leading-tight text-white">
            Every bed in your building, on one screen.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-400">
            Rooms, beds, who is staying and what they owe — instead of a register book and a
            WhatsApp group.
          </p>
        </div>

        <p className="text-xs text-ink-500">Hyderabad · PGs and hostels</p>
      </aside>

      <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 lg:px-12">
        <div className="rise">
          <span
            aria-hidden="true"
            className="figure mb-7 inline-flex size-11 items-center justify-center rounded-lg bg-brass-500 text-base font-semibold text-ink-950 lg:hidden"
          >
            PG
          </span>
          <h1 className="display text-3xl leading-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Enter your mobile number and we&apos;ll text you a code.
          </p>

          <div className="mt-7">
            <LoginForm {...(next ? { next } : {})} />
          </div>

          <p className="mt-8 text-xs text-[var(--text-muted)]">
            By signing in you agree to our terms of service and privacy policy.
          </p>
        </div>
      </main>
    </div>
  );
}
