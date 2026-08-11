/**
 * Phone numbers are the primary identity in this product, so they must
 * normalise to exactly one canonical form. "9876543210", "+919876543210",
 * "09876543210" and "91 98765 43210" are the same person.
 *
 * Canonical form is E.164: +91XXXXXXXXXX
 */

const INDIA_CALLING_CODE = '91';
/** Indian mobile numbers are 10 digits and start 6-9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export class InvalidPhoneNumberError extends Error {
  constructor(input: string) {
    super(`Not a valid Indian mobile number: ${input}`);
  }
}

export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');

  let local = digits;
  if (local.startsWith(INDIA_CALLING_CODE) && local.length === 12) {
    local = local.slice(2);
  } else if (local.startsWith('0') && local.length === 11) {
    local = local.slice(1);
  }

  if (!INDIAN_MOBILE.test(local)) {
    throw new InvalidPhoneNumberError(input);
  }

  return `+${INDIA_CALLING_CODE}${local}`;
}

export function isValidPhone(input: string): boolean {
  try {
    normalisePhone(input);
    return true;
  } catch {
    return false;
  }
}

/** For logs and support screens: +9198765***10 */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return '***';
  return `${e164.slice(0, 8)}***${e164.slice(-2)}`;
}
