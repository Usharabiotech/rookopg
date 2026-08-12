import { Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import type { ObjectStorage, StoredObject } from './storage.types';

/**
 * Development store. Writes under a configured directory.
 *
 * Not suitable for a deployed environment: a container's filesystem is
 * replaced on every release, so the photos would go with it. The config
 * validator refuses this driver in production for that reason.
 */
export class LocalDiskStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
    this.logger.log(`Storing uploads on local disk at ${this.root}`);
  }

  /**
   * Resolves a key to a path inside the root, and refuses anything that
   * escapes it. Keys are server-generated, but a traversal check on the path
   * that actually gets opened is cheap insurance.
   */
  private pathFor(key: string): string {
    const target = resolve(join(this.root, normalize(key)));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error('Refusing to resolve a storage key outside the root directory');
    }
    return target;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, sizeBytes: body.byteLength, contentType };
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  /** No direct URL exists on disk — the API streams these itself. */
  async signedReadUrl(): Promise<string | null> {
    return null;
  }
}
