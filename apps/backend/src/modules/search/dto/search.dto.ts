import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum GenderFilter {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  CO_LIVING = 'CO_LIVING',
}

export enum SharingFilter {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  DORMITORY = 'DORMITORY',
}

const csv = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').map((part) => part.trim()).filter(Boolean) : value;

export class SearchListingsQueryDto {
  @ApiPropertyOptional({ description: 'Locality id from /reference/localities' })
  @IsOptional()
  @IsUUID('all')
  localityId?: string;

  @ApiPropertyOptional({ description: 'Free text over the PG name and area' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ enum: GenderFilter })
  @IsOptional()
  @IsEnum(GenderFilter)
  gender?: GenderFilter;

  @ApiPropertyOptional({ enum: SharingFilter, isArray: true, description: 'Comma separated' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsEnum(SharingFilter, { each: true })
  sharing?: SharingFilter[];

  @ApiPropertyOptional({ description: 'Cheapest bed must be at or under this, in paise' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  maxRentPaise?: number;

  @ApiPropertyOptional({ description: 'Comma-separated amenity codes, e.g. WIFI,AC' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Only show places with a free bed', default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  availableOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class SharingOptionDto {
  @ApiProperty({ example: 'TRIPLE' }) sharingType!: string;
  @ApiProperty() fromRentPaise!: number;
  @ApiProperty() freeBeds!: number;
  @ApiProperty() hasAc!: boolean;
}

export class ListingCardDto {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() localityName!: string;
  @ApiProperty({ example: 'MEN' }) genderPolicy!: string;
  @ApiProperty({ example: 'PG' }) propertyType!: string;
  @ApiPropertyOptional() headline?: string;
  @ApiProperty() fromRentPaise!: number;
  @ApiProperty() freeBeds!: number;
  @ApiProperty() totalBeds!: number;
  @ApiPropertyOptional({ description: 'Media id for the cover photo' }) coverPhotoId?: string;
  @ApiProperty({ type: [String] }) amenityCodes!: string[];
  @ApiPropertyOptional({ example: 'VEG' }) foodType?: string;
  @ApiProperty({ type: [SharingOptionDto] }) sharingOptions!: SharingOptionDto[];
}

export class SearchResultsDto {
  @ApiProperty({ type: [ListingCardDto] }) results!: ListingCardDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class PublicRoomDto {
  @ApiProperty() sharingType!: string;
  @ApiProperty() rentPaise!: number;
  @ApiProperty() depositPaise!: number;
  @ApiProperty() freeBeds!: number;
  @ApiProperty() totalBeds!: number;
  @ApiProperty() hasAc!: boolean;
  @ApiProperty() hasAttachedBath!: boolean;
  @ApiProperty({ example: 'MEN' }) gender!: string;
}

export class PublicListingDto extends ListingCardDto {
  @ApiProperty() propertyId!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() addressLine1!: string;
  @ApiPropertyOptional() landmark?: string;
  @ApiProperty() pincode!: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiProperty({ type: [String], description: 'Media ids, cover first' }) photoIds!: string[];
  @ApiProperty({ type: [PublicRoomDto] }) rooms!: PublicRoomDto[];
  @ApiPropertyOptional() mealsIncluded?: string;
  @ApiPropertyOptional() gateClosingTime?: string;
  @ApiProperty() visitorsAllowed!: boolean;
  @ApiPropertyOptional() houseRules?: string;
  @ApiPropertyOptional() availabilityConfirmedAt?: string;
}
