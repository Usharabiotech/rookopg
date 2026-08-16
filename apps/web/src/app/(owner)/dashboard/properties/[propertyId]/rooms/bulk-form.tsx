'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui';
import { bulkCreateRoomsAction, type BulkFormState } from './actions';
import {
  describeCodes,
  duplicateCodes,
  parseFirstRoomNumber,
  resolveSets,
  roomCode,
  type RoomSet,
} from './room-codes';

let nextKey = 1;

function newSet(floor: number, gender: string, sharing = 'TRIPLE'): RoomSet {
  return {
    key: nextKey++,
    floor,
    roomCount: '',
    sharing,
    capacity: '',
    gender,
    saleMode: 'PER_BED',
    rent: '',
    deposit: '',
    hasAc: false,
    hasBath: false,
    startOverride: '',
  };
}

const SHARING_OPTIONS = [
  ['SINGLE', 'Single'],
  ['DOUBLE', '2-sharing'],
  ['TRIPLE', '3-sharing'],
  ['QUAD', '4-sharing'],
  ['DORMITORY', 'Dormitory'],
] as const;

function SubmitButton({ beds, blocked }: { beds: number; blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending || beds === 0 || blocked}>
      {pending ? 'Creating…' : beds > 0 ? `Create ${beds} beds` : 'Add rooms to continue'}
    </Button>
  );
}

export function BulkRoomForm({
  propertyId,
  defaultGender,
}: {
  propertyId: string;
  defaultGender: 'MEN' | 'WOMEN' | 'ANY';
}) {
  const [state, action] = useActionState<BulkFormState, FormData>(bulkCreateRoomsAction, {});
  const [sets, setSets] = useState<RoomSet[]>([newSet(1, defaultGender)]);
  // Only a co-living building genuinely mixes; a men's PG asking floor by
  // floor would be noise.
  const mixedGender = defaultGender === 'ANY';

  const update = (key: number, patch: Partial<RoomSet>) =>
    setSets((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const resolved = resolveSets(sets);
  const clashes = duplicateCodes(resolved);
  const totalRooms = resolved.reduce((n, r) => n + r.codes.length, 0);
  const totalBeds = resolved.reduce((n, r) => n + r.codes.length * r.bedsPerRoom, 0);
  const lastFloor = sets[sets.length - 1]?.floor ?? 1;
  const lastGender = sets[sets.length - 1]?.gender ?? defaultGender;

  // pb clears the fixed action bar; too little and the last card hides
  // behind it on a short phone screen.
  return (
    <form action={action} className="space-y-4 pb-44 sm:pb-36">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="rowCount" value={sets.length} />

      {state.error ? <Alert>{state.error}</Alert> : null}
      {clashes.length > 0 ? (
        <Alert>
          Room {clashes.join(', ')} is listed twice. Change a starting number so each room has its
          own.
        </Alert>
      ) : null}

      {resolved.map(({ set, startNumber, bedsPerRoom, codes }, index) => {
        const isDorm = set.sharing === 'DORMITORY';
        const sharingLabel =
          SHARING_OPTIONS.find(([value]) => value === set.sharing)?.[1] ?? set.sharing;

        return (
          <Card key={set.key}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                {/* The heading names what will actually be created, so the
                    field rep can check it against the doors in front of them. */}
                <h2 className="display text-lg leading-tight">
                  {codes.length > 0 ? (
                    <>
                      Rooms <span className="figure">{describeCodes(codes)}</span>
                    </>
                  ) : (
                    'New set of rooms'
                  )}
                </h2>
                <p className="eyebrow mt-1">
                  {set.floor === 0 ? 'Ground floor' : `Floor ${set.floor}`} · {sharingLabel}
                  {bedsPerRoom > 0 && codes.length > 0
                    ? ` · ${codes.length * bedsPerRoom} beds`
                    : ''}
                </p>
              </div>
              {sets.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSets((c) => c.filter((s) => s.key !== set.key))}
                  className="pressable min-h-11 rounded-lg px-2 text-sm font-medium text-rust-500 hover:bg-rust-100"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <input type="hidden" name={`floor-${index}-floor`} value={set.floor} />
            <input type="hidden" name={`floor-${index}-start`} value={startNumber} />
            {mixedGender ? null : (
              <input type="hidden" name={`floor-${index}-gender`} value={set.gender} />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Floor" htmlFor={`set-floor-${set.key}`}>
                <Input
                  id={`set-floor-${set.key}`}
                  inputMode="numeric"
                  className="figure"
                  value={set.floor}
                  onChange={(e) => update(set.key, { floor: Number(e.target.value) || 0 })}
                />
              </Field>

              <Field label="How many rooms" htmlFor={`floor-${index}-count`} required>
                <Input
                  id={`floor-${index}-count`}
                  name={`floor-${index}-count`}
                  inputMode="numeric"
                  required
                  className="figure"
                  placeholder="3"
                  value={set.roomCount}
                  onChange={(e) => update(set.key, { roomCount: e.target.value })}
                />
              </Field>

              <Field label="Sharing" htmlFor={`floor-${index}-sharing`} required>
                <Select
                  id={`floor-${index}-sharing`}
                  name={`floor-${index}-sharing`}
                  required
                  value={set.sharing}
                  onChange={(e) => update(set.key, { sharing: e.target.value })}
                >
                  {SHARING_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              {isDorm ? (
                <Field label="Beds per dormitory" htmlFor={`floor-${index}-capacity`} required>
                  <Input
                    id={`floor-${index}-capacity`}
                    name={`floor-${index}-capacity`}
                    inputMode="numeric"
                    required
                    className="figure"
                    placeholder="8"
                    value={set.capacity}
                    onChange={(e) => update(set.key, { capacity: e.target.value })}
                  />
                </Field>
              ) : (
                <input type="hidden" name={`floor-${index}-capacity`} value="" />
              )}

              {/* Only asked for a co-living building. A men's PG would just
                  be answering the same question on every floor. */}
              {mixedGender ? (
                <Field
                  label="Who stays here"
                  htmlFor={`floor-${index}-gender`}
                  hint="Mixed means men and women can share the same room"
                  required
                >
                  <Select
                    id={`floor-${index}-gender`}
                    name={`floor-${index}-gender`}
                    required
                    value={set.gender}
                    onChange={(e) => update(set.key, { gender: e.target.value })}
                  >
                    <option value="ANY">Mixed — anyone</option>
                    <option value="MEN">Men only</option>
                    <option value="WOMEN">Women only</option>
                  </Select>
                </Field>
              ) : null}

              <Field
                label="How it's rented"
                htmlFor={`floor-${index}-salemode`}
                hint={
                  set.saleMode === 'WHOLE_ROOM'
                    ? 'One tenant or couple takes the whole room'
                    : 'Each bed is let separately'
                }
              >
                <Select
                  id={`floor-${index}-salemode`}
                  name={`floor-${index}-salemode`}
                  value={set.saleMode}
                  onChange={(e) => update(set.key, { saleMode: e.target.value })}
                >
                  <option value="PER_BED">Per bed</option>
                  <option value="WHOLE_ROOM">Whole room</option>
                </Select>
              </Field>

              <Field label="Rent per bed" htmlFor={`floor-${index}-rent`} required>
                <Input
                  id={`floor-${index}-rent`}
                  name={`floor-${index}-rent`}
                  inputMode="numeric"
                  required
                  className="figure"
                  placeholder="7000"
                  value={set.rent}
                  onChange={(e) => update(set.key, { rent: e.target.value })}
                />
              </Field>

              <Field label="Deposit" htmlFor={`floor-${index}-deposit`} hint="Optional">
                <Input
                  id={`floor-${index}-deposit`}
                  name={`floor-${index}-deposit`}
                  inputMode="numeric"
                  className="figure"
                  placeholder="10000"
                  value={set.deposit}
                  onChange={(e) => update(set.key, { deposit: e.target.value })}
                />
              </Field>

              <Field
                label="First room number"
                htmlFor={`set-start-${set.key}`}
                hint={`Leave blank to carry on from ${roomCode(set.floor, startNumber)}`}
                {...(set.startOverride.trim() !== '' &&
                parseFirstRoomNumber(set.startOverride) === null
                  ? { error: 'Enter a room number on this floor, like 104' }
                  : {})}
              >
                <Input
                  id={`set-start-${set.key}`}
                  inputMode="numeric"
                  className="figure"
                  placeholder={roomCode(set.floor, startNumber)}
                  value={set.startOverride}
                  onChange={(e) => update(set.key, { startOverride: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Checkbox
                id={`floor-${index}-ac`}
                name={`floor-${index}-ac`}
                label="Air conditioned"
                checked={set.hasAc}
                onChange={(e) => update(set.key, { hasAc: e.target.checked })}
              />
              <Checkbox
                id={`floor-${index}-bath`}
                name={`floor-${index}-bath`}
                label="Attached bathroom"
                checked={set.hasBath}
                onChange={(e) => update(set.key, { hasBath: e.target.checked })}
              />
            </div>
          </Card>
        );
      })}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setSets((c) => [...c, newSet(lastFloor, lastGender, 'DOUBLE')])}
        >
          + Another set on floor {lastFloor}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setSets((c) => [...c, newSet(lastFloor + 1, lastGender)])}
        >
          + Start floor {lastFloor + 1}
        </Button>
      </div>

      {/* Fixed so the count and the action stay in thumb reach on a long form. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur lg:left-60">
        <div className="mx-auto max-w-6xl space-y-2">
          <p aria-live="polite" className="figure text-center text-sm text-[var(--text-muted)]">
            {totalRooms} rooms · {totalBeds} beds
          </p>
          <SubmitButton beds={totalBeds} blocked={clashes.length > 0} />
        </div>
      </div>
    </form>
  );
}
