import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '9876543210', description: 'Indian mobile number, with or without +91' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;
}

export class RequestOtpResponseDto {
  @ApiProperty()
  challengeId!: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;

  @ApiPropertyOptional({
    description: 'Development only. Never populated when NODE_ENV=production.',
  })
  devCode?: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;
}

export class MembershipDto {
  @ApiProperty()
  orgId!: string;

  @ApiProperty()
  orgName!: string;

  @ApiProperty({ enum: ['OWNER', 'MANAGER'] })
  role!: string;

  @ApiProperty({ type: [String], description: 'Empty means all properties in the organisation' })
  propertyIds!: string[];

  @ApiProperty({ description: 'Whether this member may add new properties' })
  canCreateProperties!: boolean;
}

/**
 * Explicit response shape. A Prisma user entity is never returned directly —
 * that is how PII leaks.
 */
export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '+919876543210' })
  phone!: string;

  @ApiPropertyOptional()
  fullName?: string;

  @ApiProperty({ type: [MembershipDto] })
  memberships!: MembershipDto[];

  @ApiProperty({ type: [String] })
  platformRoles!: string[];
}

export class AuthSessionDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  accessExpiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
