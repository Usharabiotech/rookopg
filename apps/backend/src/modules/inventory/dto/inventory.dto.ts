import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum SharingTypeDto {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  DORMITORY = 'DORMITORY',
}

export enum RoomGenderDto {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  ANY = 'ANY',
}

export enum SaleModeDto {
  PER_BED = 'PER_BED',
  WHOLE_ROOM = 'WHOLE_ROOM',
}

export enum BedStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

class RoomAttributesDto {
  @ApiProperty({ enum: SharingTypeDto })
  @IsEnum(SharingTypeDto)
  sharingType!: SharingTypeDto;

  @ApiPropertyOptional({
    description: 'Beds in the room. Defaults from sharingType; required for DORMITORY.',
    minimum: 1,
    maximum: 40,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  sharingCapacity?: number;

  @ApiProperty({ enum: RoomGenderDto })
  @IsEnum(RoomGenderDto)
  gender!: RoomGenderDto;

  @ApiProperty({ description: 'Rent for ONE bed, in paise. 700000 = Rs 7,000' })
  @IsInt()
  @Min(0)
  baseRentPaise!: number;

  @ApiPropertyOptional({ description: 'Security deposit in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositPaise?: number;

  @ApiPropertyOptional({
    enum: SaleModeDto,
    description: 'WHOLE_ROOM rents all beds together as one unit',
  })
  @IsOptional()
  @IsEnum(SaleModeDto)
  saleMode?: SaleModeDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAc?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAttachedBath?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean;
}

export class CreateRoomDto extends RoomAttributesDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @Length(1, 24)
  code!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(-2)
  @Max(60)
  floor?: number;
}

/**
 * One floor's worth of identical rooms. Rooms are numbered floor*100 + n,
 * so floor 2 with 6 rooms produces 201 through 206.
 */
export class BulkFloorDto extends RoomAttributesDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(-2)
  @Max(60)
  floor!: number;

  @ApiProperty({ example: 6, description: 'How many identical rooms on this floor' })
  @IsInt()
  @Min(1)
  @Max(60)
  roomCount!: number;

  @ApiPropertyOptional({ example: 1, description: 'First room number on the floor' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  startNumber?: number;
}

/**
 * The field-team endpoint. Setting up a 60-bed PG one room at a time is why
 * owners give up halfway and go back to a paper register.
 */
export class BulkCreateRoomsDto {
  @ApiProperty({ type: [BulkFloorDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BulkFloorDto)
  floors!: BulkFloorDto[];
}

export class UpdateRoomDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 24) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(-2) @Max(60) floor?: number;

  @ApiPropertyOptional({ enum: RoomGenderDto })
  @IsOptional()
  @IsEnum(RoomGenderDto)
  gender?: RoomGenderDto;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) baseRentPaise?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) depositPaise?: number;

  @ApiPropertyOptional({ enum: SaleModeDto })
  @IsOptional()
  @IsEnum(SaleModeDto)
  saleMode?: SaleModeDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAc?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAttachedBath?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean;
}

export class UpdateBedDto {
  @ApiPropertyOptional({ enum: BedStatusDto, description: 'BLOCKED takes it off sale for maintenance' })
  @IsOptional()
  @IsEnum(BedStatusDto)
  status?: BedStatusDto;

  @ApiPropertyOptional({ description: 'Overrides the room rent for this bed only' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rentOverridePaise?: number;
}

export class BedDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ description: 'Effective rent in paise: the bed override, or the room rate' })
  rentPaise!: number;

  @ApiProperty({ description: 'Whether the bed has an active claim today' })
  occupied!: boolean;

  @ApiPropertyOptional({ description: 'When the bed next becomes free, if occupied' })
  availableFrom?: string;

  @ApiPropertyOptional({
    description: 'Free today but already claimed from this date — cannot be let',
  })
  reservedFrom?: string;
}

export class RoomDto {
  @ApiProperty() id!: string;
  @ApiProperty() propertyId!: string;
  @ApiProperty() code!: string;
  @ApiPropertyOptional() floor?: number;
  @ApiProperty() sharingType!: string;
  @ApiProperty() sharingCapacity!: number;
  @ApiProperty() saleMode!: string;
  @ApiProperty() gender!: string;
  @ApiProperty() baseRentPaise!: number;
  @ApiProperty() depositPaise!: number;
  @ApiProperty() hasAc!: boolean;
  @ApiProperty() hasAttachedBath!: boolean;
  @ApiProperty() hasBalcony!: boolean;
  @ApiProperty() status!: string;
  @ApiProperty({ type: [BedDto] }) beds!: BedDto[];
}

export class BulkCreateResultDto {
  @ApiProperty() roomsCreated!: number;
  @ApiProperty() bedsCreated!: number;
  @ApiProperty({ type: [RoomDto] }) rooms!: RoomDto[];
}
