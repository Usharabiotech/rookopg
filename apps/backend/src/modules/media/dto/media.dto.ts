import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export enum MediaTagDto {
  EXTERIOR = 'EXTERIOR',
  ROOM = 'ROOM',
  BATHROOM = 'BATHROOM',
  KITCHEN = 'KITCHEN',
  COMMON_AREA = 'COMMON_AREA',
  DINING = 'DINING',
  ENTRANCE = 'ENTRANCE',
  OTHER = 'OTHER',
}

export class UploadMediaDto {
  @ApiPropertyOptional({ enum: MediaTagDto, description: 'What the photo shows' })
  @IsOptional()
  @IsEnum(MediaTagDto)
  tag?: MediaTagDto;

  @ApiPropertyOptional({ description: 'Attach the photo to a specific room' })
  @IsOptional()
  @IsUUID('all')
  roomId?: string;
}

export class UpdateMediaDto {
  @ApiPropertyOptional({ enum: MediaTagDto })
  @IsOptional()
  @IsEnum(MediaTagDto)
  tag?: MediaTagDto;

  @ApiPropertyOptional({ description: 'Position in the gallery; 0 is the cover photo' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('all')
  roomId?: string;
}

export class MediaDto {
  @ApiProperty() id!: string;
  @ApiProperty() propertyId!: string;
  @ApiPropertyOptional() roomId?: string;
  @ApiProperty({ enum: MediaTagDto }) tag!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ example: 'PENDING' }) moderation!: string;
  @ApiProperty() createdAt!: string;

  @ApiProperty({ description: 'Full-size image. Short-lived when served from object storage.' })
  displayUrl!: string;

  @ApiProperty({ description: 'Grid-sized image' })
  thumbUrl!: string;
}

export class UploadResultDto {
  @ApiProperty({ type: [MediaDto] }) uploaded!: MediaDto[];
  @ApiProperty({ type: [String], description: 'Files that could not be processed, with reasons' })
  rejected!: string[];
}
