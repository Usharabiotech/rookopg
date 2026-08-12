import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaTag, OrgRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../../config/env.config';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import { PropertyRepository } from '../property/property.repository';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.types';
import type { AuthenticatedActor } from '../auth/auth.types';
import { ImageService } from './image.service';
import { MediaRepository, type MediaRecord } from './media.repository';
import type { MediaDto, UpdateMediaDto, UploadResultDto } from './dto/media.dto';

const MEDIA_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];
/** A gallery beyond this is nobody's friend, and it caps abuse. */
const MAX_PHOTOS_PER_PROPERTY = 60;

export interface IncomingFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export type Variant = 'display' | 'thumb';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly signedUrlTtl: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: MediaRepository,
    private readonly properties: PropertyRepository,
    private readonly images: ImageService,
    private readonly iam: IamService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {
    this.signedUrlTtl = config.get('STORAGE_SIGNED_URL_TTL_SECONDS', { infer: true });
  }

  /** `properties/<propertyId>/<mediaId>/<variant>.webp` */
  private keyFor(propertyId: string, mediaId: string, variant: Variant): string {
    return `properties/${propertyId}/${mediaId}/${variant}.webp`;
  }

  async list(actor: AuthenticatedActor, propertyId: string): Promise<MediaDto[]> {
    await this.assertPropertyAccess(actor, propertyId);
    const media = await this.repository.listForProperty(propertyId);
    return media.map((item) => this.toDto(item));
  }

  /**
   * Accepts a batch of photos.
   *
   * One bad file does not fail the batch: a field rep who picked eight photos
   * and one screenshot should get the eight, not an error and nothing.
   */
  async upload(
    actor: AuthenticatedActor,
    propertyId: string,
    files: IncomingFile[],
    options: { tag?: MediaTag; roomId?: string },
  ): Promise<UploadResultDto> {
    await this.assertPropertyAccess(actor, propertyId, MEDIA_WRITERS);

    if (files.length === 0) {
      throw new ConflictError('Choose at least one photo.');
    }

    if (options.roomId && !(await this.repository.roomBelongsToProperty(options.roomId, propertyId))) {
      throw new NotFoundError('Room');
    }

    const existing = await this.repository.countForProperty(propertyId);
    if (existing + files.length > MAX_PHOTOS_PER_PROPERTY) {
      throw new ConflictError(
        `This property can hold ${MAX_PHOTOS_PER_PROPERTY} photos and already has ${existing}.`,
        { limit: MAX_PHOTOS_PER_PROPERTY, existing },
      );
    }

    const uploaded: MediaDto[] = [];
    const rejected: string[] = [];
    let sortOrder = await this.repository.nextSortOrder(propertyId);

    for (const file of files) {
      try {
        const processed = await this.images.process(file.buffer, file.originalname);
        const mediaId = randomUUID();

        const displayKey = this.keyFor(propertyId, mediaId, 'display');
        const thumbKey = this.keyFor(propertyId, mediaId, 'thumb');

        await this.storage.put(displayKey, processed.display.buffer, processed.contentType);
        await this.storage.put(thumbKey, processed.thumb.buffer, processed.contentType);

        // The row is written last: an orphaned object costs a few kilobytes,
        // whereas a row pointing at nothing breaks the gallery.
        const record = await this.repository.create({
          id: mediaId,
          propertyId,
          ...(options.roomId ? { roomId: options.roomId } : {}),
          tag: options.tag ?? MediaTag.OTHER,
          // The prefix; each variant appends its own filename.
          storageKey: `properties/${propertyId}/${mediaId}`,
          mimeType: processed.contentType,
          sizeBytes: processed.display.buffer.byteLength,
          sortOrder: sortOrder++,
          uploadedById: actor.userId,
        });

        uploaded.push(this.toDto(record));
      } catch (error) {
        const reason =
          error instanceof DomainError ? error.message : `${file.originalname} could not be saved.`;
        this.logger.warn(`Rejected ${file.originalname}: ${reason}`);
        rejected.push(reason);
      }
    }

    return { uploaded, rejected };
  }

  async update(
    actor: AuthenticatedActor,
    mediaId: string,
    dto: UpdateMediaDto,
  ): Promise<MediaDto> {
    const media = await this.loadAuthorised(actor, mediaId, MEDIA_WRITERS);

    if (dto.roomId && !(await this.repository.roomBelongsToProperty(dto.roomId, media.propertyId))) {
      throw new NotFoundError('Room');
    }

    const updated = await this.repository.update(mediaId, {
      ...(dto.tag ? { tag: dto.tag as MediaTag } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
    });

    return this.toDto(updated);
  }

  async remove(actor: AuthenticatedActor, mediaId: string): Promise<void> {
    const media = await this.loadAuthorised(actor, mediaId, MEDIA_WRITERS);

    // Row first this time: if the object delete fails we are left with unused
    // bytes rather than a gallery entry that 404s.
    await this.repository.delete(mediaId);

    for (const variant of ['display', 'thumb'] as const) {
      try {
        await this.storage.delete(this.keyFor(media.propertyId, mediaId, variant));
      } catch (error) {
        this.logger.warn(`Could not remove ${variant} for media ${mediaId}: ${String(error)}`);
      }
    }
  }

  /**
   * Resolves a photo for delivery.
   *
   * Object storage gives back a short-lived URL and the browser fetches the
   * bytes directly. Local disk has no such URL, so the caller streams it.
   */
  async resolveFile(
    actor: AuthenticatedActor,
    mediaId: string,
    variant: Variant,
  ): Promise<{ redirectTo: string } | { stream: Readable; contentType: string }> {
    const media = await this.loadAuthorised(actor, mediaId);
    const key = this.keyFor(media.propertyId, mediaId, variant);

    const url = await this.storage.signedReadUrl(key, this.signedUrlTtl);
    if (url) return { redirectTo: url };

    if (!(await this.storage.exists(key))) throw new NotFoundError('Photo');
    return { stream: await this.storage.getStream(key), contentType: media.mimeType };
  }

  private async loadAuthorised(
    actor: AuthenticatedActor,
    mediaId: string,
    roles: OrgRole[] = [],
  ): Promise<MediaRecord & { orgId: string }> {
    const media = await this.repository.findById(mediaId);
    if (!media) throw new NotFoundError('Photo');

    try {
      this.iam.assertPropertyAccess(actor, media.orgId, media.propertyId, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Photo');
      }
      throw error;
    }

    return media;
  }

  private async assertPropertyAccess(
    actor: AuthenticatedActor,
    propertyId: string,
    roles: OrgRole[] = [],
  ): Promise<void> {
    const property = await this.properties.findById(propertyId);
    if (!property) throw new NotFoundError('Property');

    try {
      this.iam.assertPropertyAccess(actor, property.orgId, property.id, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Property');
      }
      throw error;
    }
  }

  private toDto(media: MediaRecord): MediaDto {
    return {
      id: media.id,
      propertyId: media.propertyId,
      ...(media.roomId ? { roomId: media.roomId } : {}),
      tag: media.tag,
      sortOrder: media.sortOrder,
      sizeBytes: media.sizeBytes,
      moderation: media.moderation,
      createdAt: media.createdAt.toISOString(),
      // Always our own URL, never the storage provider's. The client does not
      // change when the provider does, and a signed URL never gets cached in
      // a database row or a page that outlives it.
      displayUrl: `/media/${media.id}/file?variant=display`,
      thumbUrl: `/media/${media.id}/file?variant=thumb`,
    };
  }
}
