'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { archivePropertyAction } from './actions';
import type { PropertyFormState } from '../../new/actions';

/**
 * Archiving, behind typing the building's name.
 *
 * Not a confirm dialog: those get dismissed by muscle memory. Typing the name
 * makes it impossible to archive the wrong building by accident, which is the
 * mistake that actually happens when somebody has eight of them.
 *
 * The API refuses outright while anyone lives there, so the worst case here is
 * a clear error rather than a lost building.
 */
export function ArchiveForm({ propertyId, name }: { propertyId: string; name: string }) {
  const [state, action, pending] = useActionState<PropertyFormState, FormData>(
    archivePropertyAction,
    {},
  );
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === name;

  return (
    <Card className="border-rust-500/30">
      <h2 className="display text-lg">Archive this building</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        It disappears from your dashboard and from search. Rent records and payments are kept —
        they have to be, for tax — so this hides the building rather than erasing its history.
        You cannot archive a building while somebody is living in it.
      </p>

      {state.error ? (
        <div className="mt-4">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      <form action={action} className="mt-4">
        <input type="hidden" name="propertyId" value={propertyId} />

        <label htmlFor="confirm-name" className="block text-sm font-medium">
          Type <span className="font-semibold">{name}</span> to confirm
        </label>
        <input
          id="confirm-name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          className="mt-2 w-full max-w-sm rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
        />

        <Button type="submit" variant="danger" className="mt-3" disabled={!matches || pending}>
          {pending ? 'Archiving…' : 'Archive'}
        </Button>
      </form>
    </Card>
  );
}
