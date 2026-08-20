'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { unlockAction, type GateState } from './actions';

export function GateForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<GateState, FormData>(unlockAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Shared with the team"
        />
      </Field>

      <Button type="submit" fullWidth disabled={pending}>
        {pending ? 'Checking…' : 'Continue'}
      </Button>
    </form>
  );
}
