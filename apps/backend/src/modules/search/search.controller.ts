import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { Public } from '../../common/decorators/auth.decorators';
import { PublicListingDto, SearchListingsQueryDto, SearchResultsDto } from './dto/search.dto';
import { SearchService } from './search.service';

class SlugParamDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Not a valid listing address' })
  slug!: string;
}

class VariantQueryDto {
  @IsOptional()
  @IsIn(['display', 'thumb'])
  variant?: 'display' | 'thumb';
}

/**
 * The public face of the marketplace. No session, no tokens.
 *
 * Everything here is gated on the listing being PUBLISHED, so unlisting a
 * property removes it and its photographs from view in the same act.
 */
@ApiTags('public')
@Controller('public')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get('listings')
  // Generous, but enough to make scraping the whole city tedious.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Search published listings' })
  @ApiOkResponse({ type: SearchResultsDto })
  async search(@Query() query: SearchListingsQueryDto): Promise<SearchResultsDto> {
    return this.service.search(query);
  }

  @Public()
  @Get('localities')
  @ApiOperation({ summary: 'Areas that currently have listings, busiest first' })
  async localities(): Promise<Array<{ id: string; name: string; slug: string; count: number }>> {
    return this.service.localities();
  }

  @Public()
  @Get('listings/:slug')
  @ApiOperation({ summary: 'One listing by its web address' })
  @ApiOkResponse({ type: PublicListingDto })
  async detail(@Param() params: SlugParamDto): Promise<PublicListingDto> {
    return this.service.findBySlug(params.slug);
  }

  @Public()
  @Get('photos/:mediaId')
  @ApiOperation({
    summary: 'A listing photo',
    description: 'Only served while the listing is published.',
  })
  async photo(
    @Param('mediaId') mediaId: string,
    @Query() query: VariantQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.service.publicPhoto(mediaId, query.variant ?? 'display');

    if ('redirectTo' in result) {
      response.redirect(HttpStatus.FOUND, result.redirectTo);
      return;
    }

    response.setHeader('Content-Type', result.contentType);
    // Public and long-lived: a changed photo gets a new id, so this can sit
    // in a CDN safely.
    response.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    result.stream.pipe(response);
  }
}
