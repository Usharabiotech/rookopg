import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface StoredObject {
  key: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Everything the application needs from a bucket, and nothing about which
 * bucket it is.
 *
 * Cloudflare R2 is the intended production store (see docs/03 §8.4 — it is
 * the one piece that does not change when compute moves from Railway to AWS).
 * Local disk exists so photos work on a laptop before any account exists.
 */
export interface ObjectStorage {
  readonly driver: 'local' | 's3';

  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;

  /** Bytes for the caller to stream. Used when signedUrl returns null. */
  getStream(key: string): Promise<Readable>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /**
   * A URL the browser may fetch directly, or null when the object can only be
   * reached by proxying through the API.
   *
   * Returning null rather than throwing is deliberate: it lets one controller
   * serve both drivers — redirect when there is a URL, stream when there is
   * not — instead of the callers branching on driver names.
   */
  signedReadUrl(key: string, ttlSeconds: number): Promise<string | null>;
}
