import { NextResponse, type NextRequest } from 'next/server';

/**
 * A shared password on a test deployment.
 *
 * Until Razorpay and WhatsApp are live this runs outside production mode, and
 * outside production the login code comes back in the sign-in response — so
 * anyone who found the URL could sign in as any phone number and book a bed
 * the development gateway confirms without taking money.
 *
 * This was HTTP Basic auth first, which is less code and needs no page. Vercel
 * strips WWW-Authenticate from middleware responses, so the browser was handed
 * a 401 with no instruction to ask for anything and simply rendered the body:
 * the words "Authentication required" on a blank page, with no way in. A
 * cookie and a form depend on nothing the platform can take away.
 *
 * Set SITE_PASSWORD to switch it on. Unset — local development, and the
 * eventual real launch — this does nothing at all.
 */
export const GATE_COOKIE = 'pg_gate';
const GATE_PATH = '/gate';

/**
 * Browsing is open; signing in is not.
 *
 * The listing pages show what is meant to be public anyway, so shutting them
 * behind a password only makes the test deployment harder to look at. What
 * genuinely cannot be left open is the sign-in: outside production the code
 * comes back on screen, so an open login is an invitation to become anybody.
 *
 * Everything not listed here is public.
 */
const GATED = ['/login', '/dashboard', '/bookings'];
const isGated = (pathname: string): boolean =>
  GATED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** Cookie holds a digest, so the password itself is never stored in a jar. */
export async function gateDigest(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`pgplatform:gate:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Browse freely. Only the sign-in and what sits behind it need the password.
  if (!isGated(pathname) && pathname !== GATE_PATH) {
    return withNoIndex(NextResponse.next());
  }

  const expected = await gateDigest(password);
  const presented = request.cookies.get(GATE_COOKIE)?.value;
  const allowed = presented === expected;

  // The gate page itself has to stay reachable, or there is no way to get in.
  if (pathname === GATE_PATH) {
    if (!allowed) return withNoIndex(NextResponse.next());
    return withNoIndex(NextResponse.redirect(new URL('/login', request.url)));
  }

  if (allowed) return withNoIndex(NextResponse.next());

  // Carry where they were headed, so the password does not cost them the page
  // they actually wanted.
  const gate = new URL(GATE_PATH, request.url);
  gate.searchParams.set('next', pathname);
  return withNoIndex(NextResponse.redirect(gate));
}

/**
 * A gated deployment must never be indexed. Belt and braces alongside
 * robots.ts — a cached copy of a site that hands out login codes is hard to
 * undo once a crawler has it.
 */
function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  /*
   * Everything except Next's own assets. The password is worth nothing if the
   * pages are shut and the routes behind them are not — /api/public-photo
   * proxies real uploads.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
