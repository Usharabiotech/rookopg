'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import { bulkFloorsSchema } from './schemas';

export interface BulkFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Creates whole floors at once.
 *
 * The form posts repeated fields (floor-0-count, floor-1-count, …) rather
 * than JSON, so it still works if JavaScript fails to load.
 */
export async function bulkCreateRoomsAction(
  _prev: BulkFormState,
  formData: FormData,
): Promise<BulkFormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!propertyId) return { error: 'Missing property.' };

  const rows = Number(formData.get('rowCount') ?? 0);
  const floors: unknown[] = [];

  for (let index = 0; index < rows; index += 1) {
    const roomCount = String(formData.get(`floor-${index}-count`) ?? '').trim();
    if (!roomCount || roomCount === '0') continue;

    floors.push({
      floor: String(formData.get(`floor-${index}-floor`) ?? ''),
      roomCount,
      sharingType: String(formData.get(`floor-${index}-sharing`) ?? ''),
      sharingCapacity: String(formData.get(`floor-${index}-capacity`) ?? '').trim() || undefined,
      gender: String(formData.get(`floor-${index}-gender`) ?? ''),
      rentRupees: String(formData.get(`floor-${index}-rent`) ?? ''),
      depositRupees: String(formData.get(`floor-${index}-deposit`) ?? '').trim() || undefined,
      hasAc: formData.get(`floor-${index}-ac`) === 'on',
      hasAttachedBath: formData.get(`floor-${index}-bath`) === 'on',
    });
  }

  if (floors.length === 0) {
    return { error: 'Add at least one floor with a room count.' };
  }

  const parsed = bulkFloorsSchema.safeParse(floors);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `Floor ${Number(issue.path[0]) + 1}: ${issue.message}` : 'Check the values.' };
  }

  try {
    await api(`/properties/${propertyId}/rooms/bulk`, {
      method: 'POST',
      body: {
        floors: parsed.data.map((floor) => ({
          floor: floor.floor,
          roomCount: floor.roomCount,
          sharingType: floor.sharingType,
          ...(floor.sharingCapacity !== undefined
            ? { sharingCapacity: floor.sharingCapacity }
            : {}),
          gender: floor.gender,
          baseRentPaise: rupeesToPaise(floor.rentRupees),
          ...(floor.depositRupees
            ? { depositPaise: rupeesToPaise(floor.depositRupees) }
            : {}),
          hasAc: floor.hasAc,
          hasAttachedBath: floor.hasAttachedBath,
        })),
      },
    });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not create the rooms.' };
  }

  revalidatePath('/');
  revalidatePath(`/properties/${propertyId}`);
  redirect(`/properties/${propertyId}`);
}
