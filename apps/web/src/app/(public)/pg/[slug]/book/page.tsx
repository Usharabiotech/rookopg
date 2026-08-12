import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getListing } from '@/lib/public-api';
import { Card, PageHeader } from '@/components/ui';
import { genderLabel } from '@/lib/format';
import { BookForm } from './book-form';

export const metadata: Metadata = { title: 'Book a bed', robots: { index: false } };

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

// Matches PLATFORM_CONVENIENCE_FEE_PAISE. Shown here only so the tenant sees
// the total before paying; the server computes the real charge.
const CONVENIENCE_FEE_PAISE = 2500;

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;
  const search = await searchParams;

  const listing = await getListing(slug);
  if (!listing) notFound();

  // Booking is the one place a tenant must be signed in. Browsing and reading
  // a listing stay open, so search engines can index them and nobody is asked
  // to sign up before they know what they are looking at.
  const signedIn = (await cookies()).get('pg_rt') !== undefined;
  if (!signedIn) {
    redirect(`/login?next=${encodeURIComponent(`/pg/${slug}/book`)}` as never);
  }

  const raw = search['sharing'];
  const initialSharing = Array.isArray(raw) ? raw[0] : raw;

  // Deposit lives on the room rows, so pair each sharing type with its own.
  const options = listing.sharingOptions.map((option) => ({
    ...option,
    depositPaise:
      listing.rooms.find((room) => room.sharingType === option.sharingType)?.depositPaise ?? 0,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <Link
        href={`/pg/${slug}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← {listing.name}
      </Link>

      <PageHeader
        eyebrow={`${listing.localityName} · ${genderLabel(listing.genderPolicy)}`}
        title="Book a bed"
        subtitle="We hold the bed for 15 minutes while you pay."
      />

      <Card>
        <BookForm
          slug={slug}
          options={options}
          {...(initialSharing ? { initialSharing } : {})}
          convenienceFeePaise={CONVENIENCE_FEE_PAISE}
          today={today}
        />
      </Card>
    </div>
  );
}
