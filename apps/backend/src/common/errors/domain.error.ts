/**
 * Stable, machine-readable error codes. Clients switch on these; the human
 * message is for logs and may change freely.
 */
export enum DomainErrorCode {
  // Auth
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS = 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RATE_LIMITED = 'OTP_RATE_LIMITED',
  /** No credential presented. The client should send the user to sign in. */
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  /** Access token missing, malformed, expired, or its session was revoked.
   *  The client should attempt a refresh before signing the user out. */
  ACCESS_TOKEN_INVALID = 'ACCESS_TOKEN_INVALID',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED = 'REFRESH_TOKEN_REUSED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',

  // Authorisation
  FORBIDDEN = 'FORBIDDEN',

  // Generic
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFLICT = 'CONFLICT',
}

/**
 * Base class for errors the domain raises deliberately. An exception filter
 * maps these to HTTP; nothing else about the internals reaches the client.
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly httpStatus: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorisedError extends DomainError {
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, 401, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have access to this resource') {
    super(DomainErrorCode.FORBIDDEN, message, 403);
  }
}

/**
 * Deliberately 404 rather than 403 when an actor asks for another
 * organisation's data. A 403 confirms the resource exists.
 */
export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(DomainErrorCode.NOT_FOUND, `${what} not found`, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(DomainErrorCode.CONFLICT, message, 409, details);
  }
}

export class RateLimitedError extends DomainError {
  constructor(code: DomainErrorCode, message: string, retryAfterSeconds: number) {
    super(code, message, 429, { retryAfterSeconds });
  }
}
