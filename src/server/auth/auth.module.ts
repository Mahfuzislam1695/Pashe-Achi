import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { CatalogModule } from '../catalog/catalog.module'
import { AdminAuthController } from './admin-auth.controller'
import { AdminAuthService } from './admin-auth.service'
import { CustomerAuthController } from './customer-auth.controller'
import { CustomerAuthService } from './customer-auth.service'
import { AdminGuard, CustomerGuard } from './guards'
import { TokenService } from './token.service'

/** Global so every module's controllers can use CustomerGuard and AdminGuard. */
@Global()
@Module({
  // Secrets are passed per call because customers and admins use different ones.
  // CatalogModule: whether customers need a password (the super admin's switch).
  imports: [JwtModule.register({}), CatalogModule],
  controllers: [CustomerAuthController, AdminAuthController],
  providers: [TokenService, CustomerAuthService, AdminAuthService, CustomerGuard, AdminGuard],
  exports: [TokenService, CustomerGuard, AdminGuard],
})
export class AuthModule {}
