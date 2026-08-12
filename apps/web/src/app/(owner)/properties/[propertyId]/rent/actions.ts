'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import type { PaymentReceipt } from '@/lib/types';
import { recordPaymentSchema } from './schemas';

export interface PaymentState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function recordPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const tenancyId = String(formData.get('tenancyId') ?? '');
  if (!propertyId || !tenancyId) return { error: 'Missing tenant.' };

  const parsed = recordPaymentSchema.safeParse({
    amountRupees: formData.get('amountRupees'),
    method: formData.get('method'),
    receivedOn: formData.get('receivedOn') || undefined,
    reference: formData.get('reference') || undefined,
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
    await api<PaymentReceipt>(`/properties/${propertyId}/payments`, {
      method: 'POST',
      body: {
        tenancyId,
        amountPaise: rupeesToPaise(input.amountRupees),
        method: input.method,
        ...(input.receivedOn ? { receivedOn: input.receivedOn } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
      },
    });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not record that payment.' };
  }

  revalidatePath(`/properties/${propertyId}/rent`);
  revalidatePath(`/properties/${propertyId}`);
  redirect(`/properties/${propertyId}/rent`);
}
