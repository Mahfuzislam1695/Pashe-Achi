import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { ReverseGeocodeDto } from '@/shared'

import { ReverseGeocodeQueryDto } from '../common/dto'
import { GeoService } from './geo.service'

/** Lookups per minute per IP. Dragging the map sends one about every second at most. */
const LOOKUPS_PER_MINUTE = 40

/**
 * Public, because signup asks for the customer's location before there is an account. It is
 * still not an open proxy to OpenStreetMap: GeoService sends one lookup a second for the whole
 * app, caches them and answers null when too many wait, and each IP gets a small limit.
 */
@ApiTags('Maps')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('reverse')
  @Throttle({ default: { limit: LOOKUPS_PER_MINUTE, ttl: 60_000 } })
  @ApiOperation({ summary: 'The address for a map pin (OpenStreetMap). `address` is null when nothing was found.' })
  reverse(@Query() query: ReverseGeocodeQueryDto): Promise<ReverseGeocodeDto> {
    return this.geo.reverse(query)
  }
}
