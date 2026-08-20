import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { GateForm } from './gate-form';

export const metadata: Metadata = {
  title: 'Test site',
  robots: { index: false, follow: false },
};

type Search = Promise<{ next?: string }>;

export default async function GatePage({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="figure inline-flex size-8 items-center justify-center rounded-md bg-[var(--action)] text-[13px] font-semibold text-[var(--on-action)]"
        >
          PG
        </span>
        <span className="display text-[15px] leading-none">PG Platform</span>
      </Link>

      <Card>
        <h1 className="display text-xl">This is a test site</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Browsing is open — you can look at any PG without this. Signing in needs the password,
          because until text messages are connected the sign-in code appears on screen instead of
          arriving on your phone, and an open door here would let anyone sign in as anyone.
        </p>

        <div className="mt-5">
          <GateForm next={next ?? '/login'} />
        </div>
      </Card>

      <p className="mt-5 text-center text-sm">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Look around without signing in
        </Link>
      </p>
    </div>
  );
}
