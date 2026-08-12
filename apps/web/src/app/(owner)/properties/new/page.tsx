import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { api, apiPublic } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import type { Amenity, AuthUser, Locality } from '@/lib/types';
import { PropertyForm } from './property-form';

export const metadata: Metadata = { title: 'Add a PG' };

export default async function NewPropertyPage() {
  const user = await api<AuthUser>('/auth/me');
  const membership = user.memberships[0];

  // A hidden button is not access control — re-check on the server.
  if (!membership || !membership.canCreateProperties) redirect('/');

  // Reference data changes rarely; cache it rather than refetching per visit.
  const [localities, amenities] = await Promise.all([
    apiPublic<Locality[]>('/reference/localities', { revalidate: 3600 }),
    apiPublic<Amenity[]>('/reference/amenities', { revalidate: 3600 }),
  ]);

  return (
    <>
      <PageHeader
        title="Add a PG"
        subtitle="Details first, then rooms and beds. You can change any of this later."
      />
      <PropertyForm orgId={membership.orgId} localities={localities} amenities={amenities} />
    </>
  );
}
