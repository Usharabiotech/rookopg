'use server';

import { revalidatePath } from 'next/cache';
import { api, isApiError } from '@/lib/api';
import { addMemberSchema } from './schemas';

export interface StaffFormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

export async function addMemberAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const orgId = String(formData.get('orgId') ?? '');
  if (!orgId) return { error: 'Missing organisation.' };

  const parsed = addMemberSchema.safeParse({
    phone: formData.get('phone'),
    fullName: formData.get('fullName') || undefined,
    role: formData.get('role'),
    canCreateProperties: formData.get('canCreateProperties') === 'on',
  });

  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  }

  try {
    await api(`/orgs/${orgId}/members`, { method: 'POST', body: parsed.data });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not add this person.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: `${parsed.data.fullName ?? 'They'} can now sign in with that number.` };
}

/**
 * Toggle a single permission.
 *
 * The server re-checks that the caller is an owner — the switch being visible
 * is not what grants the right to flip it.
 */
export async function setMemberPermissionAction(formData: FormData): Promise<void> {
  const orgId = String(formData.get('orgId') ?? '');
  const membershipId = String(formData.get('membershipId') ?? '');
  const canCreateProperties = String(formData.get('value') ?? '') === 'true';

  if (!orgId || !membershipId) return;

  await api(`/orgs/${orgId}/members/${membershipId}`, {
    method: 'PATCH',
    body: { canCreateProperties },
  });

  revalidatePath('/dashboard/staff');
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const orgId = String(formData.get('orgId') ?? '');
  const membershipId = String(formData.get('membershipId') ?? '');
  if (!orgId || !membershipId) return;

  await api(`/orgs/${orgId}/members/${membershipId}`, { method: 'DELETE' });
  revalidatePath('/dashboard/staff');
}
