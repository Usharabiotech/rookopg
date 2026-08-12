import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default async function LoginPage() {
  if (await isSignedIn()) redirect('/');

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <div className="mb-6 inline-flex size-11 items-center justify-center rounded-xl bg-teal-600 text-lg font-bold text-white">
          PG
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage your PG or hostel — rooms, beds, tenants and rent.
        </p>
      </div>

      <LoginForm />

      <p className="mt-8 text-xs text-[var(--text-muted)]">
        By signing in you agree to our terms of service and privacy policy.
      </p>
    </main>
  );
}
