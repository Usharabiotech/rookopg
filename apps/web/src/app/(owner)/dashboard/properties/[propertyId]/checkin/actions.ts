'use server';

import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import type { CheckinResult } from '@/lib/types';

export interface RedeemState {
  error?: string;
  result?: CheckinResult;
}

/**
 * Redeems a tenant's move-in pass.
 *
 * The API's refusals are the useful part here — already used, wrong building,
 * expired, locked out after too many wrong codes — so they are passed through
 * rather than flattened into "something went wrong". Somebody is standing at a
 * desk with a tenant in front of them and needs to know which it was.
 */
export async function redeemPassAction(
  propertyId: string,
  payload: { token?: string; shortCode?: string },
): Promise<RedeemState> {
  try {
    // api() serialises the body itself. Passing a string here double-encodes
    // it, and the API rejects the result as malformed JSON.
    const result = await api<CheckinResult>(`/properties/${propertyId}/checkin`, {
      method: 'POST',
      body: payload,
    });

    // The board, the tenant list and the rent page all change on a check-in.
    revalidatePath(`/dashboard/properties/${propertyId}`);
    revalidatePath(`/dashboard/properties/${propertyId}/checkin`);

    return { result };
  } catch (error) {
    if (isApiError(error)) {
      if (error.status === 404) {
        return {
          error:
            'No pass matches that. Check it belongs to this property, and that the code is right.',
        };
      }
      return { error: error.message };
    }
    throw error;
  }
}
