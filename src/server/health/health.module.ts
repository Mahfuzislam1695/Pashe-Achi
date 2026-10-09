import { Controller, Get, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { HealthDto } from '@/shared'

import { PrismaService } from '../prisma/prisma.service'

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthDto> {
    let database: HealthDto['database'] = 'up'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'down'
    }
    return { status: 'ok', database, uptime: Math.round(process.uptime()), time: new Date().toISOString() }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
