'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input } from '@/components/ui';
import {
  requestOtpAction,
  verifyOtpAction,
  type RequestOtpState,
  type VerifyOtpState,
} from './actions';

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Please wait…' : children}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [otpState, requestOtp] = useActionState<RequestOtpState, FormData>(requestOtpAction, {
    status: 'idle',
  });
  const [verifyState, verifyOtp] = useActionState<VerifyOtpState, FormData>(verifyOtpAction, {
    status: 'idle',
  });

  if (otpState.status === 'sent' && otpState.challengeId) {
    return (
      <form action={verifyOtp} className="space-y-4">
        <input type="hidden" name="challengeId" value={otpState.challengeId} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <p className="text-sm text-[var(--text-muted)]">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-[var(--text)]">+91 {otpState.phone?.slice(-10)}</span>
        </p>

        {otpState.devCode ? (
          <Alert tone="info">
            Development mode — your code is <strong className="tnum">{otpState.devCode}</strong>.
            SMS delivery is not connected yet.
          </Alert>
        ) : null}

        <Field
          label="Verification code"
          htmlFor="code"
          required
          {...(verifyState.error ? { error: verifyState.error } : {})}
        >
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="tnum text-center text-2xl tracking-[0.4em]"
            aria-describedby={verifyState.error ? 'code-error' : undefined}
          />
        </Field>

        <SubmitButton>Sign in</SubmitButton>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => window.location.reload()}
        >
          Use a different number
        </Button>
      </form>
    );
  }

  return (
    <form action={requestOtp} className="space-y-4">
      <Field
        label="Mobile number"
        htmlFor="phone"
        hint="We'll text you a code to sign in"
        required
        {...(otpState.error ? { error: otpState.error } : {})}
      >
        <div className="flex items-stretch gap-2">
          <span className="inline-flex min-h-11 items-center rounded-xl border border-sand-300 px-3 text-sm font-medium text-[var(--text-muted)] dark:border-ink-600">
            +91
          </span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            required
            autoFocus
            placeholder="98765 43210"
            className="tnum"
            aria-describedby={otpState.error ? 'phone-error' : 'phone-hint'}
          />
        </div>
      </Field>

      <SubmitButton>Send code</SubmitButton>
    </form>
  );
}
