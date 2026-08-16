import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { amenityLabel } from '@/lib/amenities';
import { getListing } from '@/lib/public-api';
import { Badge, Card, LinkButton } from '@/components/ui';
import { genderLabel, rupeesShort, sharingLabel } from '@/lib/format';
import type { PublicListing } from '@/lib/types';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: 'Listing not found' };

  const title = `${listing.name}, ${listing.localityName} — ${genderLabel(listing.genderPolicy)} PG`;
  const description =
    listing.headline ??
    `${genderLabel(listing.genderPolicy)} ${listing.propertyType.toLowerCase()} in ${listing.localityName}, Hyderabad. From ${rupeesShort(listing.fromRentPaise)} a month.`;

  return {
    title,
    description,
    alternates: { canonical: `/pg/${slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(listing.coverPhotoId
        ? { images: [{ url: `/api/public-photo/${listing.coverPhotoId}` }] }
        : {}),
    },
  };
}

/**
 * Structured data so the listing can appear as a rich result.
 *
 * Only facts already on the page — price, address, availability. Marking up
 * anything the page does not show is how a site gets penalised.
 */
function StructuredData({ listing }: { listing: PublicListing }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: listing.name,
    description: listing.headline ?? listing.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: listing.addressLine1,
      addressLocality: listing.localityName,
      addressRegion: 'Telangana',
      postalCode: listing.pincode,
      addressCountry: 'IN',
    },
    ...(listing.latitude && listing.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: listing.latitude,
            longitude: listing.longitude,
          },
        }
      : {}),
    priceRange: `${rupeesShort(listing.fromRentPaise)}+`,
    amenityFeature: listing.amenityCodes.map((code) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenityLabel(code),
      value: true,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Serialised from our own data, not user input rendered as markup.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function Gallery({ listing }: { listing: PublicListing }) {
  if (listing.photoIds.length === 0) return null;
  const [cover, ...rest] = listing.photoIds;

  return (
    <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-deep)] sm:col-span-2 sm:row-span-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/public-photo/${cover}`}
          alt={`${listing.name}, ${listing.localityName}`}
          className="aspect-4/3 size-full object-cover sm:aspect-auto"
          // The cover is the largest thing above the fold, so it loads eagerly.
          loading="eager"
          decoding="async"
        />
      </div>
      {rest.slice(0, 4).map((id, index) => (
        <div key={id} className="hidden overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-deep)] sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/public-photo/${id}?variant=thumb`}
            alt={`${listing.name} photo ${index + 2}`}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}

export default async function ListingPage({ params }: { params: Params }) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  // One row per sharing type rather than per room: a tenant is choosing
  // between "3-sharing at 7,000" and "2-sharing at 9,500", not between
  // room 101 and room 102.
  const options = listing.sharingOptions;

  return (
    <>
      <StructuredData listing={listing} />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Link
          href="/"
          className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← All PGs
        </Link>

        <Gallery listing={listing} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div>
            <p className="eyebrow">{listing.localityName}</p>
            <h1 className="display mt-1 text-2xl leading-tight sm:text-3xl">{listing.name}</h1>
            <p className="mt-2 text-[var(--text-muted)]">
              {genderLabel(listing.genderPolicy)} · {listing.addressLine1}
              {listing.landmark ? ` · near ${listing.landmark}` : ''} · {listing.pincode}
            </p>

            {listing.headline ? <p className="mt-4 text-lg">{listing.headline}</p> : null}
            {listing.description ? (
              <p className="mt-3 whitespace-pre-line text-[var(--text-muted)]">
                {listing.description}
              </p>
            ) : null}

            <h2 className="display mt-8 text-lg">Rooms and rent</h2>
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-[var(--radius-card)] border border-[var(--border)]">
              {options.map((option) => (
                <li
                  key={option.sharingType}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {sharingLabel(option.sharingType)}
                      {option.hasAc ? (
                        <span className="ml-2 text-xs font-medium text-brass-600">AC available</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {option.freeBeds > 0 ? (
                        <span className="text-moss-600">{option.freeBeds} beds free</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Currently full</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="figure text-lg font-semibold">
                      {rupeesShort(option.fromRentPaise)}
                      <span className="ml-1 font-sans text-xs font-normal text-[var(--text-muted)]">
                        /month
                      </span>
                    </p>
                    {option.freeBeds > 0 ? (
                      <LinkButton
                        href={`/pg/${slug}/book?sharing=${option.sharingType}`}
                        className="min-h-9 px-3 text-xs"
                      >
                        Book
                      </LinkButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {listing.amenityCodes.length > 0 ? (
              <>
                <h2 className="display mt-8 text-lg">What is provided</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {listing.amenityCodes.map((code) => (
                    <li key={code} className="text-sm text-[var(--text-muted)]">
                      {amenityLabel(code)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {listing.gateClosingTime || listing.houseRules || !listing.visitorsAllowed ? (
              <>
                <h2 className="display mt-8 text-lg">House rules</h2>
                <ul className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
                  {listing.gateClosingTime ? (
                    <li>Gate closes at {listing.gateClosingTime}</li>
                  ) : null}
                  <li>{listing.visitorsAllowed ? 'Visitors allowed' : 'No visitors'}</li>
                  {listing.houseRules ? <li>{listing.houseRules}</li> : null}
                </ul>
              </>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-20">
            <Card>
              <p className="text-sm text-[var(--text-muted)]">Starting from</p>
              <p className="figure mt-1 text-3xl font-semibold">
                {rupeesShort(listing.fromRentPaise)}
                <span className="ml-1 font-sans text-sm font-normal text-[var(--text-muted)]">
                  /month
                </span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {listing.freeBeds > 0 ? (
                  <Badge tone="free">{listing.freeBeds} beds free now</Badge>
                ) : (
                  <Badge tone="danger">Full at the moment</Badge>
                )}
                {listing.mealsIncluded ? <Badge>Meals: {listing.mealsIncluded}</Badge> : null}
              </div>

              {listing.freeBeds > 0 ? (
                <div className="mt-5">
                  <LinkButton href={`/pg/${slug}/book`} fullWidth>
                    Book a bed
                  </LinkButton>
                  <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                    First month&apos;s rent and deposit, paid now. The bed is held while you pay.
                  </p>
                </div>
              ) : null}

              {listing.availabilityConfirmedAt ? (
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                  Availability confirmed by the owner on{' '}
                  {new Date(listing.availabilityConfirmedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  .
                </p>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
