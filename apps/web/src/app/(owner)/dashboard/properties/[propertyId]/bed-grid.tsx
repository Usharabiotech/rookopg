import Link from 'next/link';
import { rupeesShort, sharingLabel } from '@/lib/format';
import type { Bed, Room, Tenancy } from '@/lib/types';

/*
  The occupancy board.

  This is the screen an owner opens every morning, so it answers one question
  first: who is free tonight. It is drawn as the rack of key fobs behind a
  warden's desk, because that is the thing it replaces — a tag on the hook is
  a free bed, a tag missing is someone living there.

  A free tag is a link: tapping it seats a walk-in. That is the whole point of
  the board being a board rather than a table.

  Colour is never the only signal: every tag carries its code, a title, and
  screen-reader text.
*/

type TagState = 'free' | 'taken' | 'blocked';

function stateOf(bed: Bed): TagState {
  if (bed.status !== 'ACTIVE') return 'blocked';
  return bed.occupied ? 'taken' : 'free';
}

const TAG_BASE =
  'figure relative inline-flex h-10 w-9 items-end justify-center rounded-md border pb-1.5 text-xs font-semibold';

const TAG_STYLES: Record<TagState, string> = {
  free: 'border-moss-500/40 bg-moss-100 text-moss-700 hover:border-moss-600 hover:bg-moss-500 hover:text-white',
  taken: 'border-brass-600 bg-brass-500 text-ink-950',
  blocked:
    'border-dashed border-[var(--border-strong)] bg-transparent text-[var(--text-muted)] line-through',
};

function Hole({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'absolute left-1/2 top-1.5 size-1.5 -translate-x-1/2 rounded-full ' +
        (dark ? 'bg-ink-950/40' : 'bg-[var(--border-strong)]')
      }
    />
  );
}

function KeyTag({
  bed,
  propertyId,
  occupant,
}: {
  bed: Bed;
  propertyId: string;
  occupant?: Tenancy;
}) {
  const state = stateOf(bed);

  if (state === 'free') {
    return (
      <Link
        href={`/dashboard/properties/${propertyId}/beds/${bed.id}`}
        title={`Bed ${bed.code} is free — move someone in`}
        className={`pressable ${TAG_BASE} ${TAG_STYLES.free}`}
      >
        <Hole dark={false} />
        {bed.code}
        <span className="sr-only"> is free. Move a tenant in.</span>
      </Link>
    );
  }

  const label =
    state === 'taken'
      ? occupant
        ? `${occupant.tenant.fullName} — since ${occupant.startDate}`
        : 'occupied'
      : 'out of service';

  return (
    <span title={`Bed ${bed.code} — ${label}`} className={`${TAG_BASE} ${TAG_STYLES[state]}`}>
      <Hole dark={state === 'taken'} />
      {bed.code}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function RoomRow({
  room,
  propertyId,
  byBed,
}: {
  room: Room;
  propertyId: string;
  byBed: Map<string, Tenancy>;
}) {
  const free = room.beds.filter((bed) => stateOf(bed) === 'free').length;
  const occupants = room.beds
    .map((bed) => byBed.get(bed.id))
    .filter((tenancy): tenancy is Tenancy => tenancy !== undefined);

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--border)] py-3.5">
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
          <KeyTag
            key={bed.id}
            bed={bed}
            propertyId={propertyId}
            {...(byBed.get(bed.id) ? { occupant: byBed.get(bed.id)! } : {})}
          />
        ))}
      </div>

      <div className="ml-auto text-right">
        <p
          className={
            'figure text-xs font-medium ' +
            (free > 0 ? 'text-moss-600' : 'text-[var(--text-muted)]')
          }
        >
          {free > 0 ? `${free} free` : 'full'}
        </p>
        {occupants.length > 0 ? (
          <p className="mt-0.5 max-w-40 truncate text-xs text-[var(--text-muted)]">
            {occupants.map((tenancy) => tenancy.tenant.fullName.split(' ')[0]).join(', ')}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function BedGrid({
  propertyId,
  rooms,
  tenancies,
}: {
  propertyId: string;
  rooms: Room[];
  tenancies: Tenancy[];
}) {
  const byBed = new Map(tenancies.map((tenancy) => [tenancy.bedId, tenancy]));

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
          <span className="size-3 rounded-sm border border-moss-500/40 bg-moss-100" /> free — tap
          to move someone in
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
          <section key={floor}>
            <div className="flex items-start gap-4">
              {/*
                The floor number set large and faint down the left. A building
                is stacked and the board should read that way — structure,
                not ornament.
              */}
              <div className="hidden w-14 shrink-0 pt-1 sm:block">
                <span
                  aria-hidden="true"
                  className="display block text-4xl leading-none text-[var(--border-strong)]"
                >
                  {floor === 0 ? 'G' : floor}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="eyebrow mb-1">
                  {floor === 0 ? 'Ground floor' : `Floor ${floor}`} ·{' '}
                  {floorRooms.reduce((n, room) => n + room.beds.length, 0)} beds
                </h3>
                {/* A room row is short and a floor is long, so on a wide
                    screen they run in two columns. Fourteen rooms stacked one
                    per row made the owner scroll most of a page to see a
                    building that fits on one. */}
                <ul className="grid gap-x-8 xl:grid-cols-2">
                  {floorRooms.map((room) => (
                    <RoomRow key={room.id} room={room} propertyId={propertyId} byBed={byBed} />
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
