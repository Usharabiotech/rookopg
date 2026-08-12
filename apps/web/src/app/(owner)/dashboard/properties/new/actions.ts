'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import type { PropertyDetail } from '@/lib/types';
import { createPropertySchema } from './schemas';

export interface PropertyFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const orgId = String(formData.get('orgId') ?? '');
  if (!orgId) return { error: 'Missing organisation.' };

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
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  }

  const input = parsed.data;
  let created: PropertyDetail;

  try {
    created = await api<PropertyDetail>(`/orgs/${orgId}/properties`, {
      method: 'POST',
      body: {
        name: input.name,
        propertyType: input.propertyType,
        genderPolicy: input.genderPolicy,
        addressLine1: input.addressLine1,
        ...(input.landmark ? { landmark: input.landmark } : {}),
        localityId: input.localityId,
        pincode: input.pincode,
        ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
        amenityCodes: input.amenityCodes,
        mealPlan: {
          foodType: input.foodType,
          breakfast: input.breakfast,
          lunch: input.lunch,
          dinner: input.dinner,
          includedInRent: !input.foodChargeRupees,
          ...(input.foodChargeRupees
            ? { extraChargePaise: rupeesToPaise(input.foodChargeRupees) }
            : {}),
        },
        ...(input.gateClosingTime ? { rules: { gateClosingTime: input.gateClosingTime } } : {}),
      },
    });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not save the property.' };
  }

  revalidatePath('/dashboard');
  // Straight into room setup — a property with no beds is not yet useful, and
  // the field rep is still standing in the building.
  redirect(`/dashboard/properties/${created.id}/rooms`);
}
