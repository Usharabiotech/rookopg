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
    property = await api<PropertyDetail>(`/properties/${propertyId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  // A property for men should not default its rooms to women.
  const defaultGender = property.genderPolicy === 'CO_LIVING' ? 'ANY' : property.genderPolicy;

  return (
    <>
      <Link
        href={`/properties/${propertyId}`}
        className="mb-3 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        title="Set up rooms"
        subtitle="Describe each floor once. Rooms are numbered automatically (101, 102…) and every room gets its beds."
      />

      <BulkRoomForm propertyId={propertyId} defaultGender={defaultGender} />
    </>
  );
}
