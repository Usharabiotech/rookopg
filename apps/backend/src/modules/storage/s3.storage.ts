import { Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import type { ObjectStorage, StoredObject } from './storage.types';

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * S3-compatible object storage.
 *
 * Written for Cloudflare R2, which is the deployment plan's storage choice and
 * stays put when compute moves from Railway to AWS. AWS S3 and MinIO speak the
 * same protocol and work by changing the endpoint and region.
 *
 * NOT YET EXERCISED AGAINST A REAL BUCKET. The local driver is the one that
 * has been run end to end; this path gets verified when a provider is chosen
 * and credentials exist.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly logger = new Logger(S3Storage.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
    this.logger.log(`Storing uploads in bucket "${options.bucket}" at ${options.endpoint}`);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Immutable content: the key contains a random id, so a changed photo
        // is a new key rather than a new version of this one.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key, sizeBytes: body.byteLength, contentType };
  }

  async getStream(key: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error(`Object ${key} has no body`);
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A short-lived URL the browser fetches directly, so image bytes never pass
   * through the API. The bucket itself stays private — ID documents will live
   * in a sibling bucket and must never be publicly readable.
   */
  async signedReadUrl(key: string, ttlSeconds: number): Promise<string | null> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}
