'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { GATE_COOKIE, gateDigest } from '@/middleware';

export interface GateState {
  error?: string;
}

/**
 * Opens the test deployment for one browser.
 *
 * The cookie holds a digest rather than the password, so a stolen cookie jar
 * does not hand over the password itself — and the digest is what middleware
 * compares against, never the typed value.
 */
export async function unlockAction(_prev: GateState, formData: FormData): Promise<GateState> {
  const password = process.env.SITE_PASSWORD;
  if (!password) redirect('/');

  const given = String(formData.get('password') ?? '');
  if (given !== password) {
    // Deliberately vague, and no hint about length or format.
    return { error: 'That is not the password.' };
  }

  const target = String(formData.get('next') ?? '/login');

  (await cookies()).set(GATE_COOKIE, await gateDigest(password), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.COOKIE_SECURE === '1',
    // A working day. Long enough that testers are not retyping it hourly.
    maxAge: 60 * 60 * 12,
  });

  // Only ever a path on this site. An absolute URL here would turn the gate
  // into an open redirect for anyone who knows the password. The cast is
  // because typed routes cannot know a runtime string, and the check above is
  // what makes it safe.
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/login';
  redirect(safe as Route);
}
