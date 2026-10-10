import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AuthTokens } from '@/shared'

import { AppException } from '../common/app.exception'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import type { AccessTokenPayload, Audience } from './auth.types'

const ISSUER = 'pashe-achi'
/** A refresh token reused within this window (two tabs refreshing at once) is not treated as theft. */
const REUSE_GRACE_MS = 30_000

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Access tokens are short-lived JWTs. Refresh tokens are random strings stored only as a
 * SHA-256 hash, rotated on every use. Presenting an already-rotated token revokes its whole
 * family, which logs out whoever stole it.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private secret(audience: Audience) {
    return audience === 'customer' ? this.env.JWT_ACCESS_SECRET : this.env.ADMIN_JWT_ACCESS_SECRET
  }

  async verifyAccessToken(audience: Audience, token: string): Promise<AccessTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.secret(audience), audience, issuer: ISSUER })
    } catch {
      return null
    }
  }

  /** Issues an access token and a new refresh token (optionally continuing a rotation family). */
  async issue(audience: Audience, ownerId: string, options: { familyId?: string; userAgent?: string } = {}): Promise<AuthTokens & { refreshId: string }> {
    const expiresInSeconds = this.env.ACCESS_TOKEN_TTL_MINUTES * 60
    const accessToken = await this.jwt.signAsync({ sub: ownerId } satisfies AccessTokenPayload, {
      secret: this.secret(audience),
      audience,
      issuer: ISSUER,
      expiresIn: expiresInSeconds,
    })
    const refreshToken = randomBytes(48).toString('base64url')
    const row = await this.prisma.refreshToken.create({
      data: {
        tokenHash: hash(refreshToken),
        familyId: options.familyId ?? randomUUID(),
        userId: audience === 'customer' ? ownerId : null,
        adminId: audience === 'admin' ? ownerId : null,
        userAgent: options.userAgent?.slice(0, 300),
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    })
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      refreshId: row.id,
    }
  }

  /** Exchanges a refresh token for a new pair. Throws 401 if it is unknown, expired or reused. */
  async rotate(audience: Audience, refreshToken: string | undefined, userAgent?: string): Promise<{ ownerId: string; tokens: AuthTokens }> {
    if (!refreshToken) throw AppException.unauthorized()
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) } })
    const ownerId = audience === 'customer' ? row?.userId : row?.adminId
    if (!row || !ownerId) throw AppException.unauthorized()

    if (row.revokedAt) {
      const recentlyRotated = row.replacedBy && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS
      if (!recentlyRotated) await this.revokeFamily(row.familyId)
      throw AppException.unauthorized()
    }
    if (row.expiresAt.getTime() <= Date.now()) throw AppException.unauthorized()

    const { refreshId, ...tokens } = await this.issue(audience, ownerId, { familyId: row.familyId, userAgent })
    // Only one concurrent request can win the rotation; the loser is treated like a reuse.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedBy: refreshId },
    })
    if (count !== 1) {
      await this.prisma.refreshToken.update({ where: { id: refreshId }, data: { revokedAt: new Date() } })
      throw AppException.unauthorized()
    }
    return { ownerId, tokens }
  }

  /** Revokes one refresh token (logout) and says whose it was. Unknown or already revoked tokens are ignored (null). */
  async revoke(refreshToken: string | undefined): Promise<{ userId: string | null; adminId: string | null } | null> {
    if (!refreshToken) return null
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) }, select: { id: true, userId: true, adminId: true } })
    if (!row) return null
    const { count } = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } })
    return count === 1 ? { userId: row.userId, adminId: row.adminId } : null
  }

  /** Logs an account out everywhere (password change, block, deactivation). */
  async revokeAll(audience: Audience, ownerId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { ...(audience === 'customer' ? { userId: ownerId } : { adminId: ownerId }), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } })
  }
}
