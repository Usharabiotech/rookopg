import { Injectable } from '@nestjs/common';
import { MediaKind, MediaTag, ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MediaRecord {
  id: string;
  propertyId: string;
  roomId: string | null;
  tag: MediaTag;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  moderation: ModerationStatus;
  createdAt: Date;
}

const MEDIA_SELECT = {
  id: true,
  propertyId: true,
  roomId: true,
  tag: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  sortOrder: true,
  moderation: true,
  createdAt: true,
} as const;

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForProperty(propertyId: string): Promise<MediaRecord[]> {
    return this.prisma.propertyMedia.findMany({
      where: { propertyId },
      select: MEDIA_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(mediaId: string): Promise<(MediaRecord & { orgId: string }) | null> {
    const row = await this.prisma.propertyMedia.findUnique({
      where: { id: mediaId },
      select: { ...MEDIA_SELECT, property: { select: { orgId: true } } },
    });
    if (!row) return null;
    const { property, ...rest } = row;
    return { ...rest, orgId: property.orgId };
  }

  /** Next free position, so a new photo lands at the end of the gallery. */
  async nextSortOrder(propertyId: string): Promise<number> {
    const last = await this.prisma.propertyMedia.findFirst({
      where: { propertyId },
      select: { sortOrder: true },
      orderBy: { sortOrder: 'desc' },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  async create(input: {
    id: string;
    propertyId: string;
    roomId?: string;
    tag: MediaTag;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    sortOrder: number;
    uploadedById: string;
  }): Promise<MediaRecord> {
    return this.prisma.propertyMedia.create({
      data: { ...input, kind: MediaKind.PHOTO },
      select: MEDIA_SELECT,
    });
  }

  async update(
    mediaId: string,
    data: { tag?: MediaTag; sortOrder?: number; roomId?: string | null },
  ): Promise<MediaRecord> {
    return this.prisma.propertyMedia.update({
      where: { id: mediaId },
      data,
      select: MEDIA_SELECT,
    });
  }

  async delete(mediaId: string): Promise<void> {
    await this.prisma.propertyMedia.delete({ where: { id: mediaId } });
  }

  async roomBelongsToProperty(roomId: string, propertyId: string): Promise<boolean> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId, deletedAt: null },
      select: { id: true },
    });
    return room !== null;
  }

  async countForProperty(propertyId: string): Promise<number> {
    return this.prisma.propertyMedia.count({ where: { propertyId } });
  }
}
