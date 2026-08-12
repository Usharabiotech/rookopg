import { z } from 'zod';

/**
 * Kept out of actions.ts on purpose: a 'use server' module may only export
 * async functions, so shared schemas live here and are imported by both the
 * Server Action and any client-side check.
 *
 * The server validation is the one that counts. A client copy is a courtesy
 * to the user, never a control.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits), {
    message: 'Enter a valid 10-digit mobile number',
  });

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: 'Enter the 6-digit code' });
