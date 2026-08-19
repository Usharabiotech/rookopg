'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';

export interface RoomFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Saves a room's terms.
 *
 * Rent here is the price of a *new* booking. Anyone already living in the room
 * keeps what they agreed to — their rate is frozen onto the tenancy at move-in,
 * which is deliberate and is what the screen tells the owner.
 */
export async function updateRoomAction(
  _prev: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const roomId = String(formData.get('roomId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!roomId || !propertyId) return { error: 'Missing room.' };

  const code = String(formData.get('code') ?? '').trim();
  const rent = String(formData.get('rentRupees') ?? '').trim();
  const deposit = String(formData.get('depositRupees') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!code) fieldErrors['code'] = 'Give the room a number';
  if (!rent || Number(rent.replace(/[^\d.]/g, '')) <= 0) {
    fieldErrors['rentRupees'] = 'Enter the rent per bed';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Check the highlighted fields.', fieldErrors };
  }

  try {
    await api(`/rooms/${roomId}`, {
      method: 'PATCH',
      body: {
        code,
        gender: formData.get('gender'),
        saleMode: formData.get('saleMode'),
        baseRentPaise: rupeesToPaise(rent),
        depositPaise: deposit ? rupeesToPaise(deposit) : 0,
        hasAc: formData.get('hasAc') === 'on',
        hasAttachedBath: formData.get('hasAttachedBath') === 'on',
        hasBalcony: formData.get('hasBalcony') === 'on',
      },
    });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  // Rent shows on the board, the listing and every price on the public page.
  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath(`/dashboard/properties/${propertyId}/rooms`);
  redirect(`/dashboard/properties/${propertyId}`);
}

/**
 * Removes a room.
 *
 * The API refuses while any bed in it is claimed — booked or lived in — and
 * soft-deletes otherwise. Its message names the room and the count, so it is
 * passed through rather than replaced.
 */
export async function removeRoomAction(
  _prev: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const roomId = String(formData.get('roomId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!roomId || !propertyId) return { error: 'Missing room.' };

  try {
    await api(`/rooms/${roomId}`, { method: 'DELETE' });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  revalidatePath(`/dashboard/properties/${propertyId}`);
  redirect(`/dashboard/properties/${propertyId}`);
}
