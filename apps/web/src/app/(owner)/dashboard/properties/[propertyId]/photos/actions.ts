'use server';

import { revalidatePath } from 'next/cache';
import { api, apiUpload, isApiError } from '@/lib/api';
import type { Media } from '@/lib/types';

export interface PhotoUploadState {
  uploaded?: number;
  rejected?: string[];
  error?: string;
}

const TAGS = new Set([
  'EXTERIOR',
  'ROOM',
  'BATHROOM',
  'KITCHEN',
  'COMMON_AREA',
  'DINING',
  'ENTRANCE',
  'OTHER',
]);

export async function uploadPhotosAction(
  _prev: PhotoUploadState,
  formData: FormData,
): Promise<PhotoUploadState> {
  const propertyId = String(formData.get('propertyId') ?? '');
  const tag = String(formData.get('tag') ?? 'OTHER');
  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);

  if (!propertyId) return { error: 'Missing property.' };
  if (files.length === 0) return { error: 'Choose at least one photo.' };
  if (!TAGS.has(tag)) return { error: 'Choose what the photos show.' };

  // Rebuild rather than forward: the incoming form carries fields the API
  // does not expect, and a whitelist is easier to reason about than a filter.
  const outgoing = new FormData();
  outgoing.set('tag', tag);
  for (const file of files) outgoing.append('files', file, file.name);

  try {
    const result = await apiUpload<{ uploaded: Media[]; rejected: string[] }>(
      `/dashboard/properties/${propertyId}/media`,
      outgoing,
    );
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { uploaded: result.uploaded.length, rejected: result.rejected };
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not upload those photos.' };
  }
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const mediaId = String(formData.get('mediaId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!mediaId || !propertyId) return;

  await api(`/media/${mediaId}`, { method: 'DELETE' });
  revalidatePath(`/dashboard/properties/${propertyId}`);
}

export async function setCoverPhotoAction(formData: FormData): Promise<void> {
  const mediaId = String(formData.get('mediaId') ?? '');
  const propertyId = String(formData.get('propertyId') ?? '');
  if (!mediaId || !propertyId) return;

  // Position 0 is the cover. Nothing else needs renumbering — the gallery
  // sorts by position then upload time, so ties resolve stably.
  await api(`/media/${mediaId}`, { method: 'PATCH', body: { sortOrder: 0 } });
  revalidatePath(`/dashboard/properties/${propertyId}`);
}
