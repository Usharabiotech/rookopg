'use server';

import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';

export interface DecisionState {
  error?: string;
}

/**
 * The owner accepts a booking.
 *
 * Plain FormData rather than JSON, so the buttons are ordinary submits and the
 * screen works with JavaScript broken — which is the state a field rep's phone
 * is in more often than anyone likes.
 */
export async function approveBookingAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!bookingId || !propertyId) return { error: 'Missing booking.' };

  try {
    await api(`/bookings/${bookingId}/approve`, { method: 'POST', body: {} });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  // The bed board, the tenant list and this queue all move on an acceptance.
  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath(`/dashboard/properties/${propertyId}/bookings`);
  return {};
}

/**
 * The owner declines, and the tenant is refunded in full.
 *
 * A reason is optional to the API but asked for here: the tenant is told why,
 * and "the owner said no" is a poor answer when somebody has already paid.
 */
export async function rejectBookingAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!bookingId || !propertyId) return { error: 'Missing booking.' };

  try {
    await api(`/bookings/${bookingId}/reject`, {
      method: 'POST',
      body: reason ? { reason: reason.slice(0, 400) } : {},
    });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath(`/dashboard/properties/${propertyId}/bookings`);
  return {};
}
