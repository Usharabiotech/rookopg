'use server';

import { redirect } from 'next/navigation';
import { apiPublic, isApiError } from '@/lib/api';
import { saveSession } from '@/lib/session';
import type { AuthSession } from '@/lib/types';
import { codeSchema, phoneSchema } from './schemas';

export interface RequestOtpState {
  status: 'idle' | 'sent' | 'error';
  challengeId?: string;
  phone?: string;
  devCode?: string;
  error?: string;
}

export async function requestOtpAction(
  _prev: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const parsed = phoneSchema.safeParse(String(formData.get('phone') ?? ''));
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid number' };
  }

  try {
    const result = await apiPublic<{
      challengeId: string;
      expiresInSeconds: number;
      devCode?: string;
    }>('/auth/otp/request', { method: 'POST', body: { phone: parsed.data } });

    return {
      status: 'sent',
      challengeId: result.challengeId,
      phone: parsed.data,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  } catch (error) {
    return {
      status: 'error',
      error: isApiError(error) ? error.message : 'Could not send the code. Try again.',
    };
  }
}

export interface VerifyOtpState {
  status: 'idle' | 'error';
  error?: string;
}

export async function verifyOtpAction(
  _prev: VerifyOtpState,
  formData: FormData,
): Promise<VerifyOtpState> {
  const challengeId = String(formData.get('challengeId') ?? '');
  const parsed = codeSchema.safeParse(String(formData.get('code') ?? ''));

  if (!challengeId) return { status: 'error', error: 'Request a new code.' };
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid code' };
  }

  try {
    const session = await apiPublic<AuthSession>('/auth/otp/verify', {
      method: 'POST',
      body: { challengeId, code: parsed.data },
    });
    await saveSession(session);
  } catch (error) {
    return {
      status: 'error',
      error: isApiError(error) ? error.message : 'Could not sign you in. Try again.',
    };
  }

  // Outside the try: redirect works by throwing, and must not be caught above.
  redirect('/dashboard');
}
