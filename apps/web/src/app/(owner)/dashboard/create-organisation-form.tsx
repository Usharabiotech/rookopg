'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input } from '@/components/ui';
import { createOrganisationAction, type FormState } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Creating…' : 'Continue'}
    </Button>
  );
}

export function CreateOrganisationForm() {
  const [state, action] = useActionState<FormState, FormData>(createOrganisationAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="Business name"
        htmlFor="name"
        hint="What tenants and staff will see, e.g. Sunrise Living"
        required
        {...(state.fieldErrors?.name ? { error: state.fieldErrors.name } : {})}
      >
        <Input id="name" name="name" required autoFocus maxLength={160} placeholder="Sunrise Living" />
      </Field>

      <Field
        label="Registered name"
        htmlFor="legalName"
        hint="Optional — the name on your GST or bank records"
      >
        <Input
          id="legalName"
          name="legalName"
          maxLength={200}
          placeholder="Sunrise Hospitality Pvt Ltd"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
