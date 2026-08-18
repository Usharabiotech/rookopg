import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RedeemPassDto {
  @ApiPropertyOptional({ description: 'Value read from the QR' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  token?: string;

  @ApiPropertyOptional({ description: 'The six digits under the QR, typed by staff' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'The code is six digits' })
  shortCode?: string;
}

/** What the tenant sees on their own booking. */
export class MovePassDto {
  @ApiProperty({ description: 'Encode this in the QR' })
  token!: string;

  @ApiProperty({ example: '048213' })
  shortCode!: string;

  @ApiProperty()
  validFrom!: string;

  @ApiProperty()
  validTo!: string;

  @ApiProperty({ description: 'Already used to check in' })
  used!: boolean;

  @ApiProperty()
  propertyName!: string;

  @ApiProperty({ example: '101' })
  roomCode!: string;

  @ApiProperty({ example: 'B' })
  bedCode!: string;
}

/** What the person scanning sees. */
export class CheckinResultDto {
  @ApiProperty()
  bookingId!: string;

  @ApiProperty({ example: 'Priya Sharma' })
  tenantName!: string;

  @ApiProperty({ example: '101' })
  roomCode!: string;

  @ApiProperty({ example: 'B' })
  bedCode!: string;

  @ApiProperty({ example: '2026-10-01' })
  moveInDate!: string;

  @ApiProperty({ description: 'Whether the owner has been paid yet' })
  settlementStatus!: string;

  @ApiProperty({
    description: 'Released to the owner by this check-in, in paise. Zero if settlement is retrying.',
  })
  releasedPaise!: number;

  @ApiPropertyOptional({
    description: 'Set when the check-in stands but paying the owner has not gone through yet',
  })
  settlementPending?: string;
}
