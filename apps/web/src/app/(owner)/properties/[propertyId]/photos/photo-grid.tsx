import { Badge, EmptyState } from '@/components/ui';
import type { Media } from '@/lib/types';
import { deletePhotoAction, setCoverPhotoAction } from './actions';

const TAG_LABELS: Record<string, string> = {
  EXTERIOR: 'Outside',
  ENTRANCE: 'Entrance',
  ROOM: 'Room',
  BATHROOM: 'Bathroom',
  KITCHEN: 'Kitchen',
  DINING: 'Dining',
  COMMON_AREA: 'Common area',
  OTHER: 'Other',
};

export function PhotoGrid({ propertyId, photos }: { propertyId: string; photos: Media[] }) {
  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photos yet"
        description="Tenants decide from photos, so cover the outside, a room, the bathroom, the kitchen and the common area."
      />
    );
  }

  return (
    <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <li
          key={photo.id}
          className="group relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-deep)]"
        >
          {/* Not next/image: these come from our own authenticated proxy, and
              the optimiser would need to fetch them without a session. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photo/${photo.id}?variant=thumb`}
            alt={`${TAG_LABELS[photo.tag] ?? 'Photo'} of this property`}
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            className="aspect-4/3 w-full object-cover"
          />

          <div className="absolute left-2 top-2 flex gap-1">
            {index === 0 ? <Badge tone="taken">Cover</Badge> : null}
            <Badge>{TAG_LABELS[photo.tag] ?? photo.tag}</Badge>
          </div>

          {/*
            Always visible rather than revealed on hover: this is used on a
            phone, where there is no hover, and a control you cannot find is
            not a control.
          */}
          <div className="flex items-center justify-between gap-1 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
            {index === 0 ? (
              <span className="text-xs text-[var(--text-muted)]">Shown first</span>
            ) : (
              <form action={setCoverPhotoAction}>
                <input type="hidden" name="mediaId" value={photo.id} />
                <input type="hidden" name="propertyId" value={propertyId} />
                <button
                  type="submit"
                  className="min-h-9 rounded-md px-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Make cover
                </button>
              </form>
            )}

            <form action={deletePhotoAction}>
              <input type="hidden" name="mediaId" value={photo.id} />
              <input type="hidden" name="propertyId" value={propertyId} />
              <button
                type="submit"
                className="min-h-9 rounded-md px-1.5 text-xs font-medium text-rust-500 hover:underline"
              >
                Remove
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
