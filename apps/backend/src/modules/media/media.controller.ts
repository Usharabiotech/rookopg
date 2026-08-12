import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import { MediaDto, UpdateMediaDto, UploadMediaDto, UploadResultDto } from './dto/media.dto';
import { MediaService, type Variant } from './media.service';

class VariantQueryDto {
  @IsOptional()
  @IsIn(['display', 'thumb'])
  variant?: Variant;
}

/** Matches STORAGE_MAX_UPLOAD_BYTES; multer needs the number at decoration time. */
const MAX_UPLOAD_BYTES = Number(process.env['STORAGE_MAX_UPLOAD_BYTES'] ?? 8_000_000);
const MAX_FILES_PER_REQUEST = 10;

@ApiTags('media')
@ApiBearerAuth()
@Controller()
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Get('properties/:propertyId/media')
  @ApiOperation({ summary: 'Photos for a property' })
  @ApiOkResponse({ type: [MediaDto] })
  async list(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<MediaDto[]> {
    return this.service.list(actor, propertyId);
  }

  @Post('properties/:propertyId/media')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload photos',
    description:
      'Images are re-encoded to two web-sized WebP copies; the original is discarded. ' +
      'One unreadable file does not fail the batch.',
  })
  @ApiOkResponse({ type: UploadResultDto })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_REQUEST },
    }),
  )
  async upload(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @UploadedFiles() files: Array<Express.Multer.File> | undefined,
    @Body() dto: UploadMediaDto,
  ): Promise<UploadResultDto> {
    return this.service.upload(
      actor,
      propertyId,
      (files ?? []).map((file) => ({
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
      })),
      {
        ...(dto.tag ? { tag: dto.tag as never } : {}),
        ...(dto.roomId ? { roomId: dto.roomId } : {}),
      },
    );
  }

  @Patch('media/:mediaId')
  @ApiOperation({ summary: 'Retag or reorder a photo' })
  @ApiOkResponse({ type: MediaDto })
  async update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Body() dto: UpdateMediaDto,
  ): Promise<MediaDto> {
    return this.service.update(actor, mediaId, dto);
  }

  @Delete('media/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a photo' })
  async remove(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    await this.service.remove(actor, mediaId);
  }

  /**
   * Serves the image.
   *
   * One URL regardless of where the bytes live: object storage answers with a
   * redirect to a short-lived signed URL, local disk streams. The client never
   * learns which.
   */
  @Get('media/:mediaId/file')
  @ApiOperation({ summary: 'Fetch a photo' })
  async file(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Query() query: VariantQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.service.resolveFile(actor, mediaId, query.variant ?? 'display');

    if ('redirectTo' in result) {
      response.redirect(HttpStatus.FOUND, result.redirectTo);
      return;
    }

    response.setHeader('Content-Type', result.contentType);
    // Private: these are one organisation's photos, so a shared cache must
    // not hold them. Immutable because a changed photo gets a new id.
    response.setHeader('Cache-Control', 'private, max-age=3600, immutable');
    result.stream.pipe(response);
  }
}
