'use client';

import { useActionState, useRef, useState } from 'react';
import { Alert, Button, Field, Select } from '@/components/ui';
import { uploadPhotosAction, type PhotoUploadState } from './actions';

const TAGS: Array<[string, string]> = [
  ['EXTERIOR', 'Building outside'],
  ['ENTRANCE', 'Entrance'],
  ['ROOM', 'Room'],
  ['BATHROOM', 'Bathroom'],
  ['KITCHEN', 'Kitchen'],
  ['DINING', 'Dining / mess'],
  ['COMMON_AREA', 'Common area'],
  ['OTHER', 'Something else'],
];

const MAX_EDGE = 1600;
const MAX_FILES = 10;

/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A phone camera produces 4 MB per shot. A field rep standing in a PG on
 * mobile data would wait a long time to send eight of those, so they are
 * resized here and roughly 300 KB goes over the wire. The server re-encodes
 * again for its own copies — this is about the upload, not the storage.
 */
async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 700_000) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export function PhotoUploader({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState<PhotoUploadState, FormData>(uploadPhotosAction, {});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tag, setTag] = useState('EXTERIOR');
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    if (picked.length > MAX_FILES) {
      setNote(`Ten photos at a time. Taking the first ${MAX_FILES}.`);
    }

    setBusy(true);
    try {
      const files = await Promise.all(picked.slice(0, MAX_FILES).map(downscale));

      const form = new FormData();
      form.set('propertyId', propertyId);
      form.set('tag', tag);
      for (const file of files) form.append('files', file, file.name);

      await action(form);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {note ? <Alert tone="info">{note}</Alert> : null}
      {state.uploaded ? (
        <Alert tone="success">
          Added {state.uploaded} {state.uploaded === 1 ? 'photo' : 'photos'}.
        </Alert>
      ) : null}
      {state.rejected && state.rejected.length > 0 ? (
        <Alert>
          <ul className="list-inside list-disc">
            {state.rejected.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Field label="What do these show?" htmlFor="photo-tag">
        <Select
          id="photo-tag"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          disabled={busy}
        >
          {TAGS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <input
        ref={inputRef}
        id="photo-files"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={onPick}
        disabled={busy}
      />

      <Button
        type="button"
        fullWidth
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Add photos'}
      </Button>

      <p className="text-xs text-[var(--text-muted)]">
        Up to ten at a time. Photos are shrunk on your phone first, so this works on mobile data.
      </p>
    </div>
  );
}
