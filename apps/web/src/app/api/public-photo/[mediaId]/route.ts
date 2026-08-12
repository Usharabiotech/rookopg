import { NextResponse, type NextRequest } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

/**
 * Listing photos for anyone.
 *
 * Proxied rather than linked directly so the browser never needs to know the
 * API's address, and so the response can be cached publicly — the backend
 * only serves these while the listing is published, which is the actual
 * access control.
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
    const upstream = await fetch(
      `${API_BASE_URL}/public/photos/${mediaId}?variant=${variant}`,
      { next: { revalidate: 3600 } },
    );

    if (!upstream.ok || !upstream.body) {
      return new NextResponse('Not found', { status: upstream.status === 404 ? 404 : 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/webp',
        // A changed photo gets a new id, so this is safe to hold onto.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 502 });
  }
}
