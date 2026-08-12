'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { api, apiPublic, isApiError } from '@/lib/api';
import { clearSession, readRefreshToken } from '@/lib/session';
import type { Organisation } from '@/lib/types';

export async function signOutAction(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    try {
      await apiPublic('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // Clearing our own cookies matters more than the server acknowledging.
    }
  }
  await clearSession();
  redirect('/login');
}

const organisationSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(160),
  legalName: z.string().trim().max(200).optional(),
});

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createOrganisationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = organisationSchema.safeParse({
    name: formData.get('name'),
    legalName: formData.get('legalName') || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
      ),
    };
  }

  try {
    await api<Organisation>('/orgs', { method: 'POST', body: parsed.data });
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not create the organisation.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
