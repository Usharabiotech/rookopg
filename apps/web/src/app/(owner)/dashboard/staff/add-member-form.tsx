'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { addMemberAction, type StaffFormState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Adding…' : 'Add to the team'}
    </Button>
  );
}

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<StaffFormState, FormData>(addMemberAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orgId" value={orgId} />

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field
        label="Their mobile number"
        htmlFor="phone"
        hint="They do not need an account yet — signing in with this number joins them"
        required
        {...(state.fieldErrors?.phone ? { error: state.fieldErrors.phone } : {})}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          required
          placeholder="98765 43210"
          className="tnum"
        />
      </Field>

      <Field
        label="Name"
        htmlFor="fullName"
        {...(state.fieldErrors?.fullName ? { error: state.fieldErrors.fullName } : {})}
      >
        <Input id="fullName" name="fullName" maxLength={120} placeholder="Ramesh K" />
      </Field>

      <Field label="Role" htmlFor="role" hint="Managers run the day to day. Owners can do everything.">
        <Select id="role" name="role" defaultValue="MANAGER">
          <option value="MANAGER">Manager</option>
          <option value="OWNER">Owner</option>
        </Select>
      </Field>

      <Checkbox
        id="canCreateProperties"
        name="canCreateProperties"
        label="Allow them to add new properties"
      />

      <SubmitButton />
    </form>
  );
}
