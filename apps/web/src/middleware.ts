import { NextResponse, type NextRequest } from 'next/server';

/**
 * A shared password on a test deployment.
 *
 * Until Razorpay and WhatsApp are live this runs outside production mode, and
 * outside production the login code comes back in the sign-in response —
 * anyone who finds the URL could sign in as any phone number and book a bed
 * the development gateway will happily confirm without taking money.
 *
 * So the whole site sits behind one shared password. Set SITE_PASSWORD to turn
 * it on; leave it unset and this does nothing, which is what local development
 * and the eventual real launch both want.
 *
 * Basic auth on purpose: every browser and phone already knows how to show the
 * prompt, and there is no login page to build, style or later delete.
 */
const USER = 'pgplatform';

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    // atob rather than Buffer: middleware runs on the edge runtime.
    const [user, given] = atob(header.slice(6)).split(':');
    if (user === USER && given === password) {
      const response = NextResponse.next();
      // Belt and braces alongside the robots route: a gated site must never
      // reach an index, and a stray crawl is hard to undo.
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="PG Platform — test deployment", charset="UTF-8"',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const config = {
  /*
   * Everything except Next's own assets. The password is worth nothing if the
   * pages are shut and the API routes behind them are not — /api/public-photo
   * proxies real uploads.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
