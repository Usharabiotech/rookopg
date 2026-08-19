'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import { createPropertySchema } from '../../new/schemas';
import type { PropertyFormState } from '../../new/actions';

/**
 * Saves changes to a building.
 *
 * The same schema the create form validates against, so the two cannot drift:
 * a field that is required to create a property stays required to keep it.
 */
export async function updatePropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!propertyId) return { error: 'Missing property.' };

  const parsed = createPropertySchema.safeParse({
    name: formData.get('name'),
    genderPolicy: formData.get('genderPolicy'),
    propertyType: formData.get('propertyType'),
    addressLine1: formData.get('addressLine1'),
    landmark: formData.get('landmark') || undefined,
    localityId: formData.get('localityId'),
    pincode: formData.get('pincode'),
    contactPhone: formData.get('contactPhone') || undefined,
    foodType: formData.get('foodType'),
    breakfast: formData.get('breakfast') === 'on',
    lunch: formData.get('lunch') === 'on',
    dinner: formData.get('dinner') === 'on',
    gateClosingTime: formData.get('gateClosingTime') || undefined,
    amenityCodes: formData.getAll('amenityCodes').map(String),
    foodChargeRupees: formData.get('foodChargeRupees') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: 'Check the highlighted fields.', fieldErrors };
  }

  const data = parsed.data;
  try {
    await api(`/properties/${propertyId}`, {
      method: 'PATCH',
      body: {
        name: data.name,
        genderPolicy: data.genderPolicy,
        propertyType: data.propertyType,
        addressLine1: data.addressLine1,
        ...(data.landmark ? { landmark: data.landmark } : {}),
        localityId: data.localityId,
        pincode: data.pincode,
        ...(data.contactPhone ? { contactPhone: data.contactPhone } : {}),
        amenityCodes: data.amenityCodes,
        // Meals and rules are nested objects on the API, not flat fields. The
        // backend whitelists its DTOs, so sending them flat is refused outright
        // rather than quietly ignored — which is how this was caught.
        mealPlan: {
          foodType: data.foodType,
          breakfast: data.breakfast,
          lunch: data.lunch,
          dinner: data.dinner,
          includedInRent: !data.foodChargeRupees,
          ...(data.foodChargeRupees
            ? { extraChargePaise: rupeesToPaise(data.foodChargeRupees) }
            : {}),
        },
        ...(data.gateClosingTime ? { rules: { gateClosingTime: data.gateClosingTime } } : {}),
      },
    });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  // The name and area show on the listing, the dashboard and the board.
  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath('/dashboard');
  redirect(`/dashboard/properties/${propertyId}`);
}

/**
 * Archives a building.
 *
 * The API refuses while anyone is living there and soft-deletes otherwise —
 * invoices and payments have to outlive the listing for tax, so this hides a
 * property rather than destroying its history. The refusal is passed through
 * verbatim because it already says how many tenants are in the way.
 */
export async function archivePropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!propertyId) return { error: 'Missing property.' };

  try {
    await api(`/properties/${propertyId}`, { method: 'DELETE' });
  } catch (error) {
    if (isApiError(error)) return { error: error.message };
    throw error;
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
