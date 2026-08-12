import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublishListingDto {
  @ApiPropertyOptional({
    example: 'Quiet men’s PG two minutes from Cyber Towers',
    description: 'One line shown in search results',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional({ description: 'Longer description for the listing page' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class ListingReadinessDto {
  @ApiProperty({ description: 'Whether this listing can go live' })
  ready!: boolean;

  @ApiProperty({
    type: [String],
    description: 'What still needs doing before it can be published',
  })
  blockers!: string[];

  @ApiProperty({ type: [String], description: 'Worth fixing, but not blocking' })
  warnings!: string[];
}

export class ListingStatusDto {
  @ApiProperty() propertyId!: string;
  @ApiProperty({ example: 'PUBLISHED' }) status!: string;
  @ApiPropertyOptional({ example: 'sunrise-mens-pg-madhapur-04d0f4' }) slug?: string;
  @ApiPropertyOptional() headline?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() publishedAt?: string;
  @ApiPropertyOptional() availabilityConfirmedAt?: string;
  @ApiProperty({ type: ListingReadinessDto }) readiness!: ListingReadinessDto;
}
