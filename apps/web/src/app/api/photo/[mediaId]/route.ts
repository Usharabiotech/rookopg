import { NextResponse, type NextRequest } from 'next/server';
import { apiFetchRaw, isApiError } from '@/lib/api';

/**
 * Streams a property photo to the browser.
 *
 * The API needs a bearer token and the browser does not have one — tokens
 * live in httpOnly cookies precisely so scripts cannot read them. So the
 * image request is made here, server-side, with the session's credentials.
 *
 * When storage is Cloudflare R2 the API answers with a redirect to a signed
 * URL; fetch follows it and we relay the bytes. Same code either way.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
): Promise<Response> {
  const { mediaId } = await params;
  const variant = request.nextUrl.searchParams.get('variant') === 'thumb' ? 'thumb' : 'display';

  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const upstream = await apiFetchRaw(`/media/${mediaId}/file?variant=${variant}`);

    if (!upstream.ok || !upstream.body) {
      return new NextResponse('Not found', { status: upstream.status === 404 ? 404 : 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
        // Private: one organisation's photos must not sit in a shared cache.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    if (isApiError(error) && error.isUnauthenticated) {
      return new NextResponse('Unauthorised', { status: 401 });
    }
    return new NextResponse('Unavailable', { status: 502 });
  }
}
