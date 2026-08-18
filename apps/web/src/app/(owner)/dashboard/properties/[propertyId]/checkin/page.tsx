import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import type { PropertyDetail } from '@/lib/types';
import { CheckinScanner } from './scanner';

export const metadata: Metadata = { title: 'Check someone in' };

type Params = Promise<{ propertyId: string }>;

export default async function CheckinPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  try {
    property = await api<PropertyDetail>(`/properties/${propertyId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow="Move-in"
        title="Check someone in"
        subtitle="Scan the pass on their phone. Their payment reaches you the moment you do."
      />

      <CheckinScanner propertyId={propertyId} />
    </div>
  );
}
