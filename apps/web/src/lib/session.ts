import 'server-only';
import { cookies } from 'next/headers';
import type { AuthSession } from './types';

const ACCESS_COOKIE = 'pg_at';
const REFRESH_COOKIE = 'pg_rt';

/**
 * Tokens live in httpOnly cookies and are read only on the server.
 *
 * Nothing token-shaped is ever handed to the browser, so an XSS bug on any
 * page cannot walk away with a session.
 */
const baseCookie = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.COOKIE_SECURE === '1',
} as const;

export async function readAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function saveSession(session: AuthSession): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, session.accessToken, {
    ...baseCookie,
    // Expire the cookie slightly before the token itself, so a stale token is
    // never sent when a refresh would do.
    maxAge: Math.max(30, session.accessExpiresInSeconds - 30),
  });
  store.set(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function isSignedIn(): Promise<boolean> {
  return (await readRefreshToken()) !== undefined;
}
