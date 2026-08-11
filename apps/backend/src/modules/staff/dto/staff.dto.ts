import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export enum OrgRoleDto {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
}

export class AddMemberDto {
  @ApiProperty({ example: '9876543210', description: 'Their mobile number' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ example: 'Ramesh K' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiProperty({ enum: OrgRoleDto, default: OrgRoleDto.MANAGER })
  @IsEnum(OrgRoleDto)
  role!: OrgRoleDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Properties this manager may work on. Omit or leave empty for all of them.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  // Not IsUUID('4') — ids in this system are UUID v7 (time-ordered), which a
  // v4-only check rejects.
  @IsUUID('all', { each: true })
  propertyIds?: string[];

  @ApiPropertyOptional({
    default: false,
    description: 'Allow this manager to add new properties to the organisation',
  })
  @IsOptional()
  @IsBoolean()
  canCreateProperties?: boolean;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: OrgRoleDto })
  @IsOptional()
  @IsEnum(OrgRoleDto)
  role?: OrgRoleDto;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the current property scope' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  // Not IsUUID('4') — ids in this system are UUID v7 (time-ordered), which a
  // v4-only check rejects.
  @IsUUID('all', { each: true })
  propertyIds?: string[];

  @ApiPropertyOptional({ description: 'Allow this manager to add new properties' })
  @IsOptional()
  @IsBoolean()
  canCreateProperties?: boolean;
}

export class OrgMemberDto {
  @ApiProperty() membershipId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ example: '+919876543210' }) phone!: string;
  @ApiPropertyOptional() fullName?: string;
  @ApiProperty({ enum: OrgRoleDto }) role!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() canCreateProperties!: boolean;

  @ApiProperty({ type: [String], description: 'Empty means every property' })
  propertyIds!: string[];

  @ApiProperty({ description: 'False until they have signed in for the first time' })
  hasSignedIn!: boolean;

  @ApiProperty() addedAt!: string;
}
