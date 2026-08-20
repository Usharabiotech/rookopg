import type { MetadataRoute } from 'next';

/**
 * A gated deployment must not be indexed.
 *
 * The test site returns the sign-in code in its own response, so a crawled and
 * cached copy would be worse than merely embarrassing. When SITE_PASSWORD is
 * set, everything is disallowed; without it the real rules apply.
 */
export default function robots(): MetadataRoute.Robots {
  // Public browsing is open on the test deployment, but none of it should
  // reach an index: the sign-in code is returned on screen there, and a
  // cached copy is hard to undo.
  if (process.env.SITE_PASSWORD) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind a sign-in belongs in a search result.
        disallow: ['/dashboard/', '/bookings/', '/login', '/api/'],
      },
    ],
  };
}
