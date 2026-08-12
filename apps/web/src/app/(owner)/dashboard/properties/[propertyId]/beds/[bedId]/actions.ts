'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import { seatTenantSchema } from './schemas';

export interface SeatState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function seatTenantAction(_prev: SeatState, formData: FormData): Promise<SeatState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const bedId = String(formData.get('bedId') ?? '');
  if (!propertyId || !bedId) return { error: 'Missing bed.' };

  const parsed = seatTenantSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    startDate: formData.get('startDate'),
    rentRupees: formData.get('rentRupees') || undefined,
    depositRupees: formData.get('depositRupees') || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  }

  const input = parsed.data;

  try {
    await api(`/dashboard/properties/${propertyId}/tenancies`, {
      method: 'POST',
      body: {
        bedId,
        fullName: input.fullName,
        phone: input.phone,
        startDate: input.startDate,
        // Left out entirely when blank, so the server falls back to the room
        // rate rather than being told zero.
        ...(input.rentRupees ? { agreedRentPaise: rupeesToPaise(input.rentRupees) } : {}),
        ...(input.depositRupees ? { depositPaise: rupeesToPaise(input.depositRupees) } : {}),
      },
    });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not seat this tenant.' };
  }

  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath('/dashboard');
  redirect(`/dashboard/properties/${propertyId}`);
}

export async function checkOutAction(formData: FormData): Promise<void> {
  const tenancyId = String(formData.get('tenancyId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!tenancyId || !propertyId) return;

  await api(`/tenancies/${tenancyId}/checkout`, {
    method: 'POST',
    body: { reason: 'Checked out at the desk' },
  });

  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath('/dashboard');
}
