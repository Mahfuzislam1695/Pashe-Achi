import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { ReverseGeocodeDto } from '@/shared'

import { CustomerGuard } from '../auth/guards'
import { ReverseGeocodeQueryDto } from '../common/dto'
import { GeoService } from './geo.service'

/** Signed-in customers only, so this can't be used as an open proxy to OpenStreetMap. */
@ApiTags('Maps')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('reverse')
  @ApiOperation({ summary: 'The address for a map pin (OpenStreetMap). `address` is null when nothing was found.' })
  reverse(@Query() query: ReverseGeocodeQueryDto): Promise<ReverseGeocodeDto> {
    return this.geo.reverse(query)
  }
}
