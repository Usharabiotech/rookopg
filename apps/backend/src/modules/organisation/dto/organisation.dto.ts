import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateOrganisationDto {
  @ApiProperty({ example: 'Sunrise Living', description: 'Trading name the field team hears' })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ example: 'Sunrise Hospitality Services Pvt Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;
}

export class UpdateOrganisationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;
}

export class OrganisationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() legalName?: string;
  @ApiProperty({ example: 'PENDING_VERIFICATION' }) status!: string;
  @ApiProperty({ example: 'NOT_SUBMITTED' }) verificationStatus!: string;

  @ApiProperty({ description: 'Free months of commission, counted from the first booking' })
  freePeriodMonths!: number;

  @ApiPropertyOptional({ description: 'Null until the first booking is made' })
  freePeriodStartsAt?: string;

  @ApiProperty({ description: "The caller's role in this organisation" })
  myRole!: string;

  @ApiProperty() propertyCount!: number;
  @ApiProperty() createdAt!: string;
}
