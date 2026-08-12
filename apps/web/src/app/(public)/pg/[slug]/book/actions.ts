'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createHmac } from 'node:crypto';
import { api, isApiError } from '@/lib/api';
import type { Checkout } from '@/lib/types';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

export interface BookingState {
  error?: string;
}

export async function startBookingAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const slug = String(formData.get('slug') ?? '');
  const sharingType = String(formData.get('sharingType') ?? '');
  const moveInDate = String(formData.get('moveInDate') ?? '');
  const idempotencyKey = String(formData.get('idempotencyKey') ?? '');

  if (!slug || !sharingType || !moveInDate) {
    return { error: 'Choose a room type and a move-in date.' };
  }

  let checkout: Checkout;
  try {
    checkout = await api<Checkout>('/bookings', {
      method: 'POST',
      body: { slug, sharingType, moveInDate, idempotencyKey },
    });
  } catch (error) {
    if (isApiError(error) && error.isUnauthenticated) {
      redirect(`/login?next=${encodeURIComponent(`/pg/${slug}/book?sharing=${sharingType}`)}`);
    }
    return { error: isApiError(error) ? error.message : 'Could not start the booking.' };
  }

  revalidatePath(`/pg/${slug}`);
  redirect(`/bookings/${checkout.booking.id}` as never);
}

/**
 * Development only: stands in for the tenant completing payment.
 *
 * Posts the same signed webhook the gateway would, so the path exercised here
 * is the real one — signature verification, amount check, idempotency — rather
 * than a shortcut that flips a status.
 */
export async function simulateDevPaymentAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const orderId = String(formData.get('orderId') ?? '');
  const amountPaise = Number(formData.get('amountPaise') ?? 0);
  if (!bookingId || !orderId) return;

  const payload = JSON.stringify({
    event: 'payment.captured',
    eventId: `evt_dev_${orderId}_${Date.now()}`,
    orderId,
    paymentId: `pay_dev_${orderId}`,
    amountPaise,
  });

  const signature = createHmac(
    'sha256',
    process.env.DEV_WEBHOOK_SECRET ?? 'dev-webhook-secret',
  )
    .update(payload)
    .digest('hex');

  await fetch(`${API_BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
    body: payload,
    cache: 'no-store',
  });

  revalidatePath(`/bookings/${bookingId}`);
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!bookingId) return;

  await api(`/bookings/${bookingId}/cancel`, { method: 'POST' });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath('/bookings');
}
