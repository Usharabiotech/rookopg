import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum GenderPolicyDto {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  CO_LIVING = 'CO_LIVING',
}

export enum PropertyTypeDto {
  PG = 'PG',
  HOSTEL = 'HOSTEL',
  CO_LIVING = 'CO_LIVING',
}

export enum FoodTypeDto {
  VEG = 'VEG',
  NON_VEG = 'NON_VEG',
  BOTH = 'BOTH',
  NONE = 'NONE',
}

export class MealPlanInputDto {
  @ApiProperty({ enum: FoodTypeDto })
  @IsEnum(FoodTypeDto)
  foodType!: FoodTypeDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() breakfast?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() lunch?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dinner?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() includedInRent?: boolean;

  @ApiPropertyOptional({ description: 'Monthly food charge in paise, if charged separately' })
  @IsOptional()
  @IsInt()
  @Min(0)
  extraChargePaise?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class PropertyRulesInputDto {
  @ApiPropertyOptional({ example: '22:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'gateClosingTime must be HH:mm' })
  gateClosingTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() visitorsAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() smokingAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() alcoholAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cookingAllowed?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunrise Mens PG' })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ enum: PropertyTypeDto, default: PropertyTypeDto.PG })
  @IsOptional()
  @IsEnum(PropertyTypeDto)
  propertyType?: PropertyTypeDto;

  @ApiProperty({ enum: GenderPolicyDto, description: 'Nearly every PG is gender-restricted' })
  @IsEnum(GenderPolicyDto)
  genderPolicy!: GenderPolicyDto;

  @ApiProperty({ example: 'Plot 42, Ayyappa Society' })
  @IsString()
  @Length(3, 200)
  addressLine1!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;

  @ApiPropertyOptional({ example: 'Behind Cyber Towers' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  landmark?: string;

  @ApiProperty({ description: 'Locality id from GET /reference/localities' })
  @IsString()
  localityId!: string;

  @ApiProperty({ example: '500081' })
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;

  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Day of month rent falls due. Omit to bill each tenant from their move-in date.',
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  defaultRentCycleDay?: number;

  @ApiPropertyOptional({ type: [String], example: ['WIFI', 'AC', 'LAUNDRY'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  amenityCodes?: string[];

  @ApiPropertyOptional({ type: MealPlanInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealPlanInputDto)
  mealPlan?: MealPlanInputDto;

  @ApiPropertyOptional({ type: PropertyRulesInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyRulesInputDto)
  rules?: PropertyRulesInputDto;
}

/**
 * Every field optional, validators preserved. PartialType keeps the two in
 * step — a field added to CreatePropertyDto is automatically patchable, with
 * no second list to forget to update.
 */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class PropertySummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() orgId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() propertyType!: string;
  @ApiProperty() genderPolicy!: string;
  @ApiProperty() localityName!: string;
  @ApiProperty() pincode!: string;

  @ApiProperty({ description: 'Beds that exist and are not deactivated' })
  totalBeds!: number;

  @ApiProperty({ description: 'Beds with no active claim today' })
  availableBeds!: number;

  @ApiProperty() roomCount!: number;
  @ApiProperty() listingStatus!: string;
  @ApiProperty() createdAt!: string;
}

export class PropertyDetailDto extends PropertySummaryDto {
  @ApiProperty() addressLine1!: string;
  @ApiPropertyOptional() addressLine2?: string;
  @ApiPropertyOptional() landmark?: string;
  @ApiProperty() localityId!: string;
  @ApiPropertyOptional() latitude?: number;
  @ApiPropertyOptional() longitude?: number;
  @ApiPropertyOptional() contactPhone?: string;
  @ApiPropertyOptional() defaultRentCycleDay?: number;
  @ApiProperty({ type: [String] }) amenityCodes!: string[];
  @ApiPropertyOptional({ type: MealPlanInputDto }) mealPlan?: MealPlanInputDto;
  @ApiPropertyOptional({ type: PropertyRulesInputDto }) rules?: PropertyRulesInputDto;
}
