import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { ENV, type Env } from '../config/env'
import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
  }

  async onModuleInit() {
    await this.$connect()
    await this.assertUtf8()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  /**
   * Bangla text needs a UTF8 database. PostgreSQL on Windows creates databases in the system code
   * page (e.g. WIN1252) unless told otherwise, and then every Bangla write fails, so stop early.
   */
  private async assertUtf8() {
    const [row] = await this.$queryRaw<{ encoding: string }[]>`SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = current_database()`
    if (row && row.encoding !== 'UTF8') {
      throw new Error(
        `The database uses ${row.encoding} encoding, but Bangla text needs UTF8. Recreate it with:\n` +
          `  CREATE DATABASE pashe_achi ENCODING 'UTF8' TEMPLATE template0;`,
      )
    }
  }
}
