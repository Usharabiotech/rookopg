import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

class LocalityQueryDto {
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class LocalityDto {
  id!: string;
  name!: string;
  slug!: string;
  city!: string;
}

class AmenityDto {
  code!: string;
  name!: string;
  category!: string;
  isFilterable!: boolean;
}

/** Read-only reference data. Public so the signup form can load before login. */
@ApiTags('reference')
@Controller('reference')
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('localities')
  @ApiOperation({ summary: 'Localities, optionally filtered by name' })
  @ApiOkResponse({ type: [LocalityDto] })
  async localities(@Query() query: LocalityQueryDto): Promise<LocalityDto[]> {
    return this.prisma.locality.findMany({
      where: {
        active: true,
        city: query.city ?? 'Hyderabad',
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      },
      select: { id: true, name: true, slug: true, city: true },
      orderBy: { name: 'asc' },
    });
  }

  @Public()
  @Get('amenities')
  @ApiOperation({ summary: 'Amenity catalogue' })
  @ApiOkResponse({ type: [AmenityDto] })
  async amenities(): Promise<AmenityDto[]> {
    return this.prisma.amenity.findMany({
      select: { code: true, name: true, category: true, isFilterable: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
