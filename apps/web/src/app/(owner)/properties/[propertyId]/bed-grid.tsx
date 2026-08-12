import { rupeesShort, sharingLabel } from '@/lib/format';
import type { Room } from '@/lib/types';

/**
 * The occupancy board.
 *
 * This is the screen an owner opens every morning, so it has to answer "who
 * is free tonight" in one glance: colour carries the signal, but every tile
 * also has a text label and title so it does not depend on colour alone.
 */

function BedTile({ code, state }: { code: string; state: 'free' | 'taken' | 'blocked' }) {
  const styles = {
    free: 'border-teal-600/40 bg-teal-50 text-teal-700 dark:bg-teal-900 dark:text-teal-100',
    taken: 'border-transparent bg-teal-600 text-white',
    blocked: 'border-sand-300 bg-sand-200 text-ink-400 line-through dark:border-ink-600 dark:bg-ink-800',
  } as const;

  const labels = { free: 'free', taken: 'occupied', blocked: 'out of service' } as const;

  return (
    <span
      title={`Bed ${code} — ${labels[state]}`}
      className={`inline-flex size-9 items-center justify-center rounded-lg border text-xs font-bold ${styles[state]}`}
    >
      {code}
      <span className="sr-only"> {labels[state]}</span>
    </span>
  );
}

function RoomRow({ room }: { room: Room }) {
  const free = room.beds.filter((bed) => bed.status === 'ACTIVE' && !bed.occupied).length;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] py-3 last:border-0">
      <div className="w-28 shrink-0">
        <p className="font-semibold">
          Room {room.code}
          {room.hasAc ? <span className="ml-1 text-xs font-normal text-teal-600">AC</span> : null}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {sharingLabel(room.sharingType)} · {rupeesShort(room.baseRentPaise)}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {room.beds.map((bed) => (
          <BedTile
            key={bed.id}
            code={bed.code}
            state={bed.status !== 'ACTIVE' ? 'blocked' : bed.occupied ? 'taken' : 'free'}
          />
        ))}
      </div>

      <p className="tnum ml-auto text-xs font-medium text-[var(--text-muted)]">
        {free > 0 ? `${free} free` : 'Full'}
      </p>
    </li>
  );
}

export function BedGrid({ rooms }: { rooms: Room[] }) {
  const byFloor = rooms.reduce<Map<number, Room[]>>((acc, room) => {
    const floor = room.floor ?? 0;
    const list = acc.get(floor) ?? [];
    list.push(room);
    acc.set(floor, list);
    return acc;
  }, new Map());

  const floors = [...byFloor.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-teal-600/40 bg-teal-50" /> free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-teal-600" /> occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-sand-200" /> out of service
        </span>
      </div>

      {floors.map(([floor, floorRooms]) => (
        <section key={floor}>
          <h3 className="mb-1 text-sm font-semibold">
            {floor === 0 ? 'Ground floor' : `Floor ${floor}`}
          </h3>
          <ul>
            {floorRooms.map((room) => (
              <RoomRow key={room.id} room={room} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
