import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, apiPublic, isApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import type { Amenity, Locality, PropertyDetail } from '@/lib/types';
import { PropertyForm } from '../../new/property-form';
import { ArchiveForm } from './archive-form';
import { updatePropertyAction } from './actions';

export const metadata: Metadata = { title: 'Edit building' };

type Params = Promise<{ propertyId: string }>;

export default async function EditPropertyPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  let localities: Locality[];
  let amenities: Amenity[];
  try {
    [property, localities, amenities] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      apiPublic<Locality[]>('/reference/localities', { revalidate: 3600 }),
      apiPublic<Amenity[]>('/reference/amenities', { revalidate: 3600 }),
    ]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow="Edit"
        title={property.name}
        subtitle="Changes show on your listing straight away. Rent is set per room, on the rooms page."
      />

      {/*
        The property id travels in the form rather than a closure, so the same
        component serves creating and editing without knowing which it is.
      */}
      <PropertyForm
        orgId={property.orgId}
        localities={localities}
        amenities={amenities}
        action={updatePropertyAction}
        property={property}
        submitLabel="Save changes"
      />

      <div className="mt-10 pb-32">
        <ArchiveForm propertyId={propertyId} name={property.name} />
      </div>
    </div>
  );
}
