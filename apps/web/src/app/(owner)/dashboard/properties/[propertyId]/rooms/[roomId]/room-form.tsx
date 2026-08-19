'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui';
import { paiseToRupees } from '@/lib/format';
import type { Room } from '@/lib/types';
import { removeRoomAction, updateRoomAction, type RoomFormState } from './actions';

export function RoomForm({
  room,
  propertyId,
  occupiedBeds,
  mixedGender,
}: {
  room: Room;
  propertyId: string;
  occupiedBeds: number;
  mixedGender: boolean;
}) {
  const [state, action, saving] = useActionState<RoomFormState, FormData>(updateRoomAction, {});
  const [removeState, remove, removing] = useActionState<RoomFormState, FormData>(
    removeRoomAction,
    {},
  );
  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <>
      <form action={action} className="space-y-5">
        <input type="hidden" name="roomId" value={room.id} />
        <input type="hidden" name="propertyId" value={propertyId} />
        {state.error ? <Alert>{state.error}</Alert> : null}

        <Card>
          <div className="space-y-4">
            <Field
              label="Room number"
              htmlFor="code"
              required
              {...(err('code') ? { error: err('code')! } : {})}
            >
              <Input
                id="code"
                name="code"
                required
                maxLength={24}
                className="figure"
                defaultValue={room.code}
              />
            </Field>

            <Field
              label="Rent per bed"
              htmlFor="rentRupees"
              required
              hint={
                occupiedBeds > 0
                  ? `${occupiedBeds} ${occupiedBeds === 1 ? 'person is' : 'people are'} already living here. Their rent does not change — this is the price for the next tenant.`
                  : 'Per month, per bed'
              }
              {...(err('rentRupees') ? { error: err('rentRupees')! } : {})}
            >
              <Input
                id="rentRupees"
                name="rentRupees"
                inputMode="numeric"
                required
                className="figure"
                defaultValue={paiseToRupees(room.baseRentPaise)}
              />
            </Field>

            <Field label="Deposit" htmlFor="depositRupees" hint="Refundable. Leave blank for none.">
              <Input
                id="depositRupees"
                name="depositRupees"
                inputMode="numeric"
                className="figure"
                defaultValue={room.depositPaise ? paiseToRupees(room.depositPaise) : ''}
              />
            </Field>

            {mixedGender ? (
              <Field label="Who stays here" htmlFor="gender">
                <Select id="gender" name="gender" defaultValue={room.gender}>
                  <option value="ANY">Mixed — anyone</option>
                  <option value="MEN">Men only</option>
                  <option value="WOMEN">Women only</option>
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="gender" value={room.gender} />
            )}

            <Field label="How it's rented" htmlFor="saleMode">
              <Select id="saleMode" name="saleMode" defaultValue={room.saleMode}>
                <option value="PER_BED">Per bed</option>
                <option value="WHOLE_ROOM">Whole room</option>
              </Select>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">This room has</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                <Checkbox id="hasAc" name="hasAc" label="AC" defaultChecked={room.hasAc} />
                <Checkbox
                  id="hasAttachedBath"
                  name="hasAttachedBath"
                  label="Attached bath"
                  defaultChecked={room.hasAttachedBath}
                />
                <Checkbox
                  id="hasBalcony"
                  name="hasBalcony"
                  label="Balcony"
                  defaultChecked={room.hasBalcony}
                />
              </div>
            </fieldset>
          </div>
        </Card>

        <Button type="submit" fullWidth disabled={saving || removing}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      {/*
        Sharing type is missing on purpose. Changing a triple to a double means
        adding or removing beds, and a bed may have somebody in it — that is the
        bulk room tool's job, not a dropdown here.
      */}
      <Card className="mt-8 border-rust-500/30">
        <h2 className="display text-lg">Remove this room</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Only possible while none of its beds are booked or lived in. Rent already billed for
          this room is kept.
        </p>
        {removeState.error ? (
          <div className="mt-4">
            <Alert>{removeState.error}</Alert>
          </div>
        ) : null}
        <form action={remove} className="mt-4">
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <Button type="submit" variant="danger" disabled={saving || removing}>
            {removing ? 'Removing…' : `Remove room ${room.code}`}
          </Button>
        </form>
      </Card>
    </>
  );
}
