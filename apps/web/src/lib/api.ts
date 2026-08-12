import 'server-only';
import { readAccessToken, readRefreshToken, saveSession } from './session';
import type { ApiErrorBody, AuthSession } from './types';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Opt into caching for reference data that rarely changes. */
  revalidate?: number;
  auth?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // Non-JSON error body; fall through to a generic message.
  }
  return new ApiError(
    response.status,
    body.code ?? 'UNKNOWN',
    body.message ?? 'Something went wrong. Please try again.',
    body.details,
  );
}

async function rawRequest<T>(path: string, options: RequestOptions, token?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: 'no-store' }),
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Unauthenticated call — login, reference data. */
export async function apiPublic<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawRequest<T>(path, options);
}

/**
 * Authenticated call.
 *
 * On a 401 it rotates the refresh token once and retries. The access token is
 * short-lived by design, so this happens routinely rather than exceptionally.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = await readAccessToken();

  if (accessToken) {
    try {
      return await rawRequest<T>(path, options, accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isUnauthenticated) throw error;
    }
  }

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in again');
  }

  const refreshed = await rawRequest<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
  await saveSession(refreshed);

  return rawRequest<T>(path, options, refreshed.accessToken);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
