import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/env.config';
import { LocalDiskStorage } from './local-disk.storage';
import { S3Storage } from './s3.storage';
import { OBJECT_STORAGE, type ObjectStorage } from './storage.types';

/**
 * Picks the store from configuration, once, at boot.
 *
 * Nothing downstream knows which one it got — that is the whole point.
 * Choosing a provider at deployment is an environment change, not a code
 * change.
 */
@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): ObjectStorage => {
        if (config.get('STORAGE_DRIVER', { infer: true }) === 's3') {
          return new S3Storage({
            // Presence is enforced by the config validator when the driver is
            // s3, so these are non-null by the time we get here.
            endpoint: config.get('S3_ENDPOINT', { infer: true }) as string,
            region: config.get('S3_REGION', { infer: true }),
            bucket: config.get('S3_BUCKET', { infer: true }) as string,
            accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }) as string,
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }) as string,
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          });
        }
        return new LocalDiskStorage(config.get('STORAGE_LOCAL_DIR', { infer: true }));
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
