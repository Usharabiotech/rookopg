'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui';
import { bulkCreateRoomsAction, type BulkFormState } from './actions';
import { BEDS_PER_SHARING } from './schemas';

interface FloorRow {
  key: number;
  floor: number;
  roomCount: string;
  sharing: string;
  capacity: string;
  rent: string;
}

let nextKey = 1;

function newRow(floor: number): FloorRow {
  return { key: nextKey++, floor, roomCount: '', sharing: 'TRIPLE', capacity: '', rent: '' };
}

function SubmitButton({ beds }: { beds: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending || beds === 0}>
      {pending ? 'Creating…' : beds > 0 ? `Create ${beds} beds` : 'Add a floor to continue'}
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
  const [rows, setRows] = useState<FloorRow[]>([newRow(1)]);

  const update = (key: number, patch: Partial<FloorRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // Live total, so the field rep can sanity-check against the building in
  // front of them before committing.
  const totalBeds = rows.reduce((sum, row) => {
    const rooms = Number(row.roomCount) || 0;
    const perRoom = BEDS_PER_SHARING[row.sharing] ?? (Number(row.capacity) || 0);
    return sum + rooms * perRoom;
  }, 0);
  const totalRooms = rows.reduce((sum, row) => sum + (Number(row.roomCount) || 0), 0);

  return (
    <form action={action} className="space-y-4 pb-28">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="rowCount" value={rows.length} />

      {state.error ? <Alert>{state.error}</Alert> : null}

      {rows.map((row, index) => {
        const isDorm = row.sharing === 'DORMITORY';
        return (
          <Card key={row.key}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">
                {row.floor === 0 ? 'Ground floor' : `Floor ${row.floor}`}
              </h2>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  className="min-h-11 px-2 text-sm font-medium text-clay-600"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <input type="hidden" name={`floor-${index}-floor`} value={row.floor} />
            <input type="hidden" name={`floor-${index}-gender`} value={defaultGender} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Floor number" htmlFor={`floor-num-${row.key}`}>
                <Input
                  id={`floor-num-${row.key}`}
                  inputMode="numeric"
                  className="tnum"
                  value={row.floor}
                  onChange={(event) => update(row.key, { floor: Number(event.target.value) || 0 })}
                />
              </Field>

              <Field label="How many rooms" htmlFor={`floor-${index}-count`} required>
                <Input
                  id={`floor-${index}-count`}
                  name={`floor-${index}-count`}
                  inputMode="numeric"
                  className="tnum"
                  placeholder="6"
                  value={row.roomCount}
                  onChange={(event) => update(row.key, { roomCount: event.target.value })}
                />
              </Field>

              <Field label="Sharing" htmlFor={`floor-${index}-sharing`} required>
                <Select
                  id={`floor-${index}-sharing`}
                  name={`floor-${index}-sharing`}
                  value={row.sharing}
                  onChange={(event) => update(row.key, { sharing: event.target.value })}
                >
                  <option value="SINGLE">Single</option>
                  <option value="DOUBLE">2-sharing</option>
                  <option value="TRIPLE">3-sharing</option>
                  <option value="QUAD">4-sharing</option>
                  <option value="DORMITORY">Dormitory</option>
                </Select>
              </Field>

              {isDorm ? (
                <Field label="Beds per dormitory" htmlFor={`floor-${index}-capacity`} required>
                  <Input
                    id={`floor-${index}-capacity`}
                    name={`floor-${index}-capacity`}
                    inputMode="numeric"
                    className="tnum"
                    placeholder="8"
                    value={row.capacity}
                    onChange={(event) => update(row.key, { capacity: event.target.value })}
                  />
                </Field>
              ) : (
                <input type="hidden" name={`floor-${index}-capacity`} value="" />
              )}

              <Field label="Rent per bed" htmlFor={`floor-${index}-rent`} required>
                <Input
                  id={`floor-${index}-rent`}
                  name={`floor-${index}-rent`}
                  inputMode="numeric"
                  className="tnum"
                  placeholder="₹ 7000"
                  value={row.rent}
                  onChange={(event) => update(row.key, { rent: event.target.value })}
                />
              </Field>

              <Field label="Deposit" htmlFor={`floor-${index}-deposit`} hint="Optional">
                <Input
                  id={`floor-${index}-deposit`}
                  name={`floor-${index}-deposit`}
                  inputMode="numeric"
                  className="tnum"
                  placeholder="₹ 10000"
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Checkbox id={`floor-${index}-ac`} name={`floor-${index}-ac`} label="Air conditioned" />
              <Checkbox
                id={`floor-${index}-bath`}
                name={`floor-${index}-bath`}
                label="Attached bathroom"
              />
            </div>
          </Card>
        );
      })}

      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={() =>
          setRows((current) => [...current, newRow((current[current.length - 1]?.floor ?? 0) + 1)])
        }
      >
        + Add another floor
      </Button>

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2">
          <p aria-live="polite" className="tnum text-center text-sm text-[var(--text-muted)]">
            {totalRooms} rooms · {totalBeds} beds
          </p>
          <SubmitButton beds={totalBeds} />
        </div>
      </div>
    </form>
  );
}
