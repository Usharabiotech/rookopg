import { Injectable, Logger } from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';
import { ConflictError } from '../../common/errors/domain.error';

/** Wide enough for a full-bleed photo on a desktop listing page. */
const DISPLAY_WIDTH = 1600;
/** Enough for a grid thumbnail at 2x on a phone. */
const THUMB_WIDTH = 400;

const ACCEPTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'heif', 'avif']);

export interface ProcessedImage {
  display: { buffer: Buffer; width: number; height: number };
  thumb: { buffer: Buffer };
  contentType: 'image/webp';
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Turns whatever a phone produced into two web-sized WebP images.
   *
   * Originals are deliberately discarded. A 12MP JPEG is 4 MB; the display
   * copy is a few hundred kilobytes, and nobody browsing PGs on mobile data
   * benefits from the difference. Storing both would multiply the bill for
   * bytes no one will ever fetch.
   *
   * Re-encoding also strips EXIF, which is worth having on purpose: phone
   * photos carry GPS coordinates, and a tenant should not be able to read the
   * exact location out of a listing image.
   */
  async process(input: Buffer, originalName: string): Promise<ProcessedImage> {
    let metadata: Metadata;
    try {
      metadata = await sharp(input).metadata();
    } catch {
      throw new ConflictError(`${originalName} is not an image we can read.`);
    }

    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new ConflictError(
        `${originalName} is a ${metadata.format ?? 'unknown'} file. Use a JPEG, PNG or WebP photo.`,
      );
    }

    // A "decompression bomb": small file, enormous canvas.
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    if (pixels > 80_000_000) {
      throw new ConflictError(`${originalName} is too large to process.`);
    }

    const base = sharp(input, { failOn: 'error' })
      // Phones record orientation in EXIF rather than rotating the pixels.
      // Without this, half the photos arrive on their side.
      .rotate();

    const display = await base
      .clone()
      .resize({ width: DISPLAY_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await base
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    this.logger.debug(
      `${originalName}: ${Math.round(input.byteLength / 1024)}KB in, ${Math.round(display.data.byteLength / 1024)}KB display, ${Math.round(thumb.byteLength / 1024)}KB thumb`,
    );

    return {
      display: {
        buffer: display.data,
        width: display.info.width,
        height: display.info.height,
      },
      thumb: { buffer: thumb },
      contentType: 'image/webp',
    };
  }
}
