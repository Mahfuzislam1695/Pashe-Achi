import type { NestExpressApplication } from '@nestjs/platform-express'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import type { ServerOptions } from 'socket.io'

import { API_PREFIX, APP_NAME, SOCKET_NAMESPACE } from '@/shared'
import { COOKIE_NAMES } from './auth/cookies'
import type { Env } from './config/env'

/** Requests NestJS answers itself (REST under /api/v1, Swagger under /api/docs). Everything else is a page. */
export function isApiPath(path: string) {
  return path === '/api' || path.startsWith('/api/')
}

/**
 * Socket.IO shares the HTTP server with Next.js. By default engine.io closes every WebSocket upgrade
 * that isn't its own after a second, which would cut Next's hot-reload socket in development.
 */
class AppIoAdapter extends IoAdapter {
  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, destroyUpgrade: false })
  }
}

/** The API setup. main.ts adds the pages on top; the e2e tests use this alone. */
export function configureApp(app: NestExpressApplication, env: Env) {
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix(API_PREFIX)
  // An app-wide setting, so it also covers the pages (they skip helmet below).
  app.disable('x-powered-by')
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cookieParser())
  app.useWebSocketAdapter(new AppIoAdapter(app))
  app.enableShutdownHooks()

  const config = new DocumentBuilder()
    .setTitle(`${APP_NAME.en} API`)
    .setDescription(
      `REST API for the ${APP_NAME.en} web app, admin panel and mobile app. Browsers authenticate with httpOnly cookies; ` +
        `mobile apps send \`Authorization: Bearer <accessToken>\` from the login response. Realtime notifications use Socket.IO at \`${SOCKET_NAMESPACE}\`.`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(COOKIE_NAMES.customer.access, { type: 'apiKey', in: 'cookie' }, COOKIE_NAMES.customer.access)
    .addCookieAuth(COOKIE_NAMES.admin.access, { type: 'apiKey', in: 'cookie' }, COOKIE_NAMES.admin.access)
    .build()
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config))
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' })
}
