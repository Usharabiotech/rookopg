'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { recordPaymentAction, type PaymentState } from '../actions';

const METHODS: Array<[string, string]> = [
  ['CASH', 'Cash'],
  ['UPI_DIRECT', 'UPI to you directly'],
  ['BANK_TRANSFER', 'Bank transfer'],
];

function SubmitButton({ amount }: { amount: string }) {
  const { pending } = useFormStatus();
  const value = Number(amount.replace(/[^\d.]/g, ''));
  return (
    <Button type="submit" fullWidth disabled={pending || !(value > 0)}>
      {pending
        ? 'Saving…'
        : value > 0
          ? `Record ₹${value.toLocaleString('en-IN')} received`
          : 'Enter an amount'}
    </Button>
  );
}

export function PayForm({
  propertyId,
  tenancyId,
  outstandingRupees,
  monthlyRupees,
  today,
}: {
  propertyId: string;
  tenancyId: string;
  outstandingRupees: string;
  monthlyRupees: string;
  today: string;
}) {
  const [state, action] = useActionState<PaymentState, FormData>(recordPaymentAction, {});
  // Pre-filled with everything they owe, because "he cleared his dues" is the
  // common case and should need no typing.
  const [amount, setAmount] = useState(outstandingRupees);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="tenancyId" value={tenancyId} />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="How much did they pay?"
        htmlFor="amountRupees"
        required
        {...(state.fieldErrors?.amountRupees ? { error: state.fieldErrors.amountRupees } : {})}
      >
        <Input
          id="amountRupees"
          name="amountRupees"
          inputMode="numeric"
          required
          autoFocus
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="figure text-xl"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        {outstandingRupees !== '0' ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 px-3 text-xs"
            onClick={() => setAmount(outstandingRupees)}
          >
            Everything owed · ₹{Number(outstandingRupees).toLocaleString('en-IN')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="min-h-9 px-3 text-xs"
          onClick={() => setAmount(monthlyRupees)}
        >
          One month · ₹{Number(monthlyRupees).toLocaleString('en-IN')}
        </Button>
      </div>

      <Field
        label="How did they pay?"
        htmlFor="method"
        required
        {...(state.fieldErrors?.method ? { error: state.fieldErrors.method } : {})}
      >
        <Select id="method" name="method" defaultValue="CASH" required>
          {METHODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Received on"
          htmlFor="receivedOn"
          {...(state.fieldErrors?.receivedOn ? { error: state.fieldErrors.receivedOn } : {})}
        >
          <Input id="receivedOn" name="receivedOn" type="date" defaultValue={today} max={today} />
        </Field>

        <Field label="Reference" htmlFor="reference" hint="Optional — a UPI id, say">
          <Input id="reference" name="reference" maxLength={120} placeholder="UPI 401234567890" />
        </Field>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        The oldest unpaid month is cleared first. Anything extra is held as credit against next
        month.
      </p>

      <SubmitButton amount={amount} />
    </form>
  );
}
