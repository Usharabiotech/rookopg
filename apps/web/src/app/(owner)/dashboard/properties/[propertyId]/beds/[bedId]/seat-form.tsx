'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input } from '@/components/ui';
import { seatTenantAction, type SeatState } from './actions';

function SubmitButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Saving…' : name.trim() ? `Move ${name.trim().split(' ')[0]} in` : 'Move them in'}
    </Button>
  );
}

export function SeatForm({
  propertyId,
  bedId,
  roomCode,
  bedCode,
  defaultRentRupees,
  defaultDepositRupees,
  today,
}: {
  propertyId: string;
  bedId: string;
  roomCode: string;
  bedCode: string;
  defaultRentRupees: string;
  defaultDepositRupees: string;
  today: string;
}) {
  const [state, action] = useActionState<SeatState, FormData>(seatTenantAction, {});
  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="bedId" value={bedId} />

      {state.error ? <Alert>{state.error}</Alert> : null}

      {/*
        Only name, phone and date are required. Rent and deposit are
        pre-filled from the room, so the usual case is two fields and a tap —
        which is the difference between staff using this and reaching for the
        register book.
      */}
      <Field
        label="Their name"
        htmlFor="fullName"
        required
        {...(err('fullName') ? { error: err('fullName')! } : {})}
      >
        <Input
          id="fullName"
          name="fullName"
          required
          autoFocus
          autoComplete="name"
          maxLength={120}
          placeholder="Ravi Kumar"
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="phone"
        hint="They can sign in with this later to see their rent"
        required
        {...(err('phone') ? { error: err('phone')! } : {})}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          required
          placeholder="98765 43210"
          className="figure"
        />
      </Field>

      <Field
        label="Moving in on"
        htmlFor="startDate"
        required
        {...(err('startDate') ? { error: err('startDate')! } : {})}
      >
        <Input id="startDate" name="startDate" type="date" required defaultValue={today} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Rent agreed"
          htmlFor="rentRupees"
          hint={`Room rate is ₹${defaultRentRupees}`}
        >
          <Input
            id="rentRupees"
            name="rentRupees"
            inputMode="numeric"
            className="figure"
            placeholder={defaultRentRupees}
          />
        </Field>

        <Field
          label="Deposit taken"
          htmlFor="depositRupees"
          hint={`Usually ₹${defaultDepositRupees}`}
        >
          <Input
            id="depositRupees"
            name="depositRupees"
            inputMode="numeric"
            className="figure"
            placeholder={defaultDepositRupees}
          />
        </Field>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Bed <span className="figure font-semibold">{bedCode}</span> in room{' '}
        <span className="figure font-semibold">{roomCode}</span>. Rent will be due on the day of
        the month they move in.
      </p>

      <SubmitButton name="" />
    </form>
  );
}
