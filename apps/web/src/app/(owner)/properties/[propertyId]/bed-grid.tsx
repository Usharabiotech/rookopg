import { rupeesShort, sharingLabel } from '@/lib/format';
import type { Bed, Room } from '@/lib/types';

/*
  The occupancy board.

  This is the screen an owner opens every morning, so it answers one question
  first: who is free tonight. It is drawn as the rack of key fobs behind a
  warden's desk, because that is the thing it replaces — a tag on the hook is
  a free bed, a tag missing is someone living there.

  Colour is never the only signal: every tag carries its code, a title, and
  screen-reader text.
*/

type TagState = 'free' | 'taken' | 'blocked';

function stateOf(bed: Bed): TagState {
  if (bed.status !== 'ACTIVE') return 'blocked';
  return bed.occupied ? 'taken' : 'free';
}

const TAG_STYLES: Record<TagState, string> = {
  free: 'border-moss-500/40 bg-moss-100 text-moss-700',
  taken: 'border-brass-600 bg-brass-500 text-ink-950',
  blocked:
    'border-dashed border-[var(--border-strong)] bg-transparent text-[var(--text-muted)] line-through',
};

const TAG_LABELS: Record<TagState, string> = {
  free: 'free',
  taken: 'occupied',
  blocked: 'out of service',
};

function KeyTag({ bed }: { bed: Bed }) {
  const state = stateOf(bed);
  return (
    <span
      title={`Bed ${bed.code} — ${TAG_LABELS[state]}`}
      className={`figure relative inline-flex h-10 w-9 items-end justify-center rounded-md border pb-1.5 text-xs font-semibold ${TAG_STYLES[state]}`}
    >
      {/* The hole the fob hangs by. Small, and the whole reason this reads as
          a key rather than a chip. */}
      <span
        aria-hidden="true"
        className={
          'absolute left-1/2 top-1.5 size-1.5 -translate-x-1/2 rounded-full ' +
          (state === 'taken' ? 'bg-ink-950/40' : 'bg-[var(--border-strong)]')
        }
      />
      {bed.code}
      <span className="sr-only"> {TAG_LABELS[state]}</span>
    </span>
  );
}

function RoomRow({ room }: { room: Room }) {
  const free = room.beds.filter((bed) => stateOf(bed) === 'free').length;

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--border)] py-3.5 first:border-t-0">
      <div className="w-32 shrink-0">
        <p className="figure text-sm font-semibold">
          {room.code}
          {room.hasAc ? (
            <span className="ml-1.5 font-sans text-[10px] font-medium uppercase tracking-wide text-brass-600">
              AC
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {sharingLabel(room.sharingType)} · {rupeesShort(room.baseRentPaise)}
        </p>
      </div>

      <div className="rack flex flex-wrap gap-1.5">
        {room.beds.map((bed) => (
          <KeyTag key={bed.id} bed={bed} />
        ))}
      </div>

      <p
        className={
          'figure ml-auto text-xs font-medium ' +
          (free > 0 ? 'text-moss-600' : 'text-[var(--text-muted)]')
        }
      >
        {free > 0 ? `${free} free` : 'full'}
      </p>
    </li>
  );
}

export function BedGrid({ rooms }: { rooms: Room[] }) {
  const byFloor = new Map<number, Room[]>();
  for (const room of rooms) {
    const floor = room.floor ?? 0;
    byFloor.set(floor, [...(byFloor.get(floor) ?? []), room]);
  }
  const floors = [...byFloor.entries()].sort(([a], [b]) => a - b);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-moss-500/40 bg-moss-100" /> free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-brass-600 bg-brass-500" /> occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-dashed border-[var(--border-strong)]" />{' '}
          out of service
        </span>
      </div>

      <div className="space-y-7">
        {floors.map(([floor, floorRooms]) => (
          <section key={floor} className="relative">
            {/*
              The floor number set large and faint, running down the left.
              A building is stacked, and the board should read that way — this
              is structure, not ornament.
            */}
            <div className="flex items-start gap-4">
              <div className="hidden w-14 shrink-0 pt-1 sm:block">
                <span
                  aria-hidden="true"
                  className="display block text-4xl leading-none text-[var(--border-strong)]"
                >
                  {floor === 0 ? 'G' : floor}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="eyebrow mb-1 sm:hidden">
                  {floor === 0 ? 'Ground floor' : `Floor ${floor}`}
                </h3>
                <h3 className="eyebrow mb-1 hidden sm:block">
                  {floor === 0 ? 'Ground floor' : `Floor ${floor}`} ·{' '}
                  {floorRooms.reduce((n, room) => n + room.beds.length, 0)} beds
                </h3>
                <ul>
                  {floorRooms.map((room) => (
                    <RoomRow key={room.id} room={room} />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
