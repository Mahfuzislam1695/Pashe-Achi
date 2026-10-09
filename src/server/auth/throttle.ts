import { Throttle } from '@nestjs/throttler'

/** Stricter limit for login/signup/refresh: AUTH_THROTTLE_LIMIT requests per minute per IP. */
export const AuthThrottle = () => Throttle({ default: { limit: () => Number(process.env.AUTH_THROTTLE_LIMIT) || 10, ttl: 60_000 } })
