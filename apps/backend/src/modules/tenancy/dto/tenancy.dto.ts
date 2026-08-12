import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Seating a walk-in.
 *
 * Only four things are required — bed, name, phone, move-in date — because a
 * warden with a person standing in front of them will abandon anything longer
 * and go back to the register book. Rent falls back to the room's rate.
 */
export class SeatTenantDto {
  @ApiProperty({ description: 'The free bed they are taking' })
  @IsUUID('all')
  bedId!: string;

  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: '2026-08-15', description: 'Move-in date (YYYY-MM-DD)' })
  @IsDateString({ strict: true } as never)
  startDate!: string;

  @ApiPropertyOptional({ description: 'Agreed rent in paise. Defaults to the room rate.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  agreedRentPaise?: number;

  @ApiPropertyOptional({ description: 'Deposit in paise. Defaults to the room deposit.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositPaise?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 31,
    description: 'Day of month rent is due. Defaults to the move-in day.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  cycleAnchorDay?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  noticeDays?: number;
}

export class GiveNoticeDto {
  @ApiProperty({ example: '2026-09-30', description: 'The date they intend to leave' })
  @IsDateString({ strict: true } as never)
  vacateDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Defaults to today' })
  @IsOptional()
  @IsDateString({ strict: true } as never)
  vacateDate?: string;

  @ApiPropertyOptional({ description: 'Deposit actually returned, in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  depositReturnedPaise?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

export class TenantSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ example: '+919876543210' }) phone!: string;
  @ApiProperty({ description: 'False until they have signed in themselves' })
  hasClaimedAccount!: boolean;
}

export class TenancyDto {
  @ApiProperty() id!: string;
  @ApiProperty() propertyId!: string;
  @ApiProperty() bedId!: string;
  @ApiProperty({ example: '101' }) roomCode!: string;
  @ApiProperty({ example: 'B' }) bedCode!: string;
  @ApiProperty({ type: TenantSummaryDto }) tenant!: TenantSummaryDto;

  @ApiProperty({ example: '2026-08-15' }) startDate!: string;
  @ApiPropertyOptional({ example: '2026-09-30', description: 'Set once notice is given' })
  endDate?: string;

  @ApiProperty() agreedRentPaise!: number;
  @ApiProperty() depositPaise!: number;
  @ApiPropertyOptional() cycleAnchorDay?: number;
  @ApiProperty() noticeDays!: number;

  @ApiProperty({ example: 'ACTIVE' }) status!: string;
  @ApiProperty({ example: 'OFFLINE' }) source!: string;
  @ApiProperty() createdAt!: string;
}
