import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import type { PropertyDetail } from '@/lib/types';
import { BulkRoomForm } from './bulk-form';

export const metadata: Metadata = { title: 'Set up rooms' };

type Params = Promise<{ propertyId: string }>;

export default async function RoomsSetupPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  try {
    property = await api<PropertyDetail>(`/dashboard/properties/${propertyId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  // A property for men should not default its rooms to women.
  const defaultGender = property.genderPolicy === 'CO_LIVING' ? 'ANY' : property.genderPolicy;

  return (
    <>
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-3 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow={property.name}
        title="Set up rooms"
        subtitle="Add a set for each group of identical rooms. A floor can hold several sets — three 2-sharing rooms and three 3-sharing rooms is normal. Beds are created with each room."
      />

      <BulkRoomForm propertyId={propertyId} defaultGender={defaultGender} />
    </>
  );
}
