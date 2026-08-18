import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export enum SharingTypeDto {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TRIPLE = 'TRIPLE',
  QUAD = 'QUAD',
  DORMITORY = 'DORMITORY',
}

export class CreateBookingDto {
  @ApiProperty({ example: 'sunrise-mens-pg-madhapur-04d0f4' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Not a valid listing address' })
  slug!: string;

  @ApiProperty({ enum: SharingTypeDto, description: 'Which kind of room' })
  @IsEnum(SharingTypeDto)
  sharingType!: SharingTypeDto;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString({ strict: true } as never)
  moveInDate!: string;

  /**
   * Who is moving in.
   *
   * Signing in takes only a phone number, so without this the owner has a
   * booking from nobody: the arrivals queue and the check-in screen both had
   * nothing to show but the word "Tenant", which is no use to a warden trying
   * to match the person at the door. Only recorded when we do not already
   * know the name.
   */
  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Send the same key to retry safely; a double tap will not book twice.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'That bed was taken by a walk-in yesterday' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BookingPriceDto {
  @ApiProperty() rentPaise!: number;
  @ApiProperty() depositPaise!: number;
  @ApiProperty() convenienceFeePaise!: number;
  @ApiProperty({ description: 'What you pay now' }) totalPayablePaise!: number;
}

export class BookingDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'PENDING_PAYMENT' }) status!: string;
  @ApiProperty() propertyName!: string;
  @ApiProperty() localityName!: string;
  @ApiPropertyOptional() listingSlug?: string;
  @ApiProperty({ example: '101' }) roomCode!: string;
  @ApiProperty({ example: 'B' }) bedCode!: string;
  @ApiProperty({ example: 'TRIPLE' }) sharingType!: string;
  @ApiProperty({ example: '2026-09-01' }) moveInDate!: string;
  @ApiProperty({ type: BookingPriceDto }) price!: BookingPriceDto;
  @ApiPropertyOptional({ description: 'Gateway order to pay against' }) orderId?: string;
  @ApiPropertyOptional({ description: 'When the held bed is released' }) holdExpiresAt?: string;
  @ApiPropertyOptional({ description: 'When the owner must have responded by' })
  approvalExpiresAt?: string;
  @ApiPropertyOptional() tenantName?: string;
  @ApiPropertyOptional() tenantPhone?: string;
  @ApiProperty() createdAt!: string;
}

export class CheckoutDto {
  @ApiProperty({ type: BookingDto }) booking!: BookingDto;
  @ApiProperty({ description: 'Gateway order to pay against' }) orderId!: string;
  @ApiProperty() amountPaise!: number;
  @ApiPropertyOptional({ description: 'Public checkout key. Never the secret.' })
  publicKey?: string;
  @ApiProperty({ example: 'dev' }) provider!: string;
}
