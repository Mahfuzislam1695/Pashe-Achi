// Must stay the first import: it loads .env and sets NODE_ENV before any other module reads them.
import { DEV } from './load-env'

import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import next from 'next'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'
import { configureApp, isApiPath } from './bootstrap'
import { ENV, type Env } from './config/env'
import { PROJECT_ROOT } from './project-root'

/**
 * One server on one port. NestJS answers /api/* (REST and Swagger) and Socket.IO, and hands every
 * other request to Next.js, which renders the customer site (/) and the admin panel (/admin).
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  const env = app.get<Env>(ENV)

  const pages = next({ dev: DEV, dir: PROJECT_ROOT, httpServer: app.getHttpServer(), port: env.PORT })
  const handlePage = pages.getRequestHandler()
  // Registered before configureApp, so page requests skip the API's helmet, body parsers and request log.
  app.use((request: Request, response: Response, nextHandler: NextFunction) =>
    isApiPath(request.path) ? nextHandler() : void handlePage(request, response),
  )

  configureApp(app, env)
  await pages.prepare()
  await app.listen(env.PORT)
  app.get(Logger).log(`Ready on http://localhost:${env.PORT} (admin panel: /admin, API docs: /api/docs)`, 'Bootstrap')
}

void bootstrap()
