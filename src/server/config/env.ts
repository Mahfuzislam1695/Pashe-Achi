import { z } from 'zod'

const secret = z.string().min(32, 'must be at least 32 characters')

export const envSchema = z
  .object({
    // Set by src/server/load-env.ts: development for `npm run dev`, production for `npm start`.
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    // The one port for everything: pages, the admin panel, the API and Socket.IO.
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string'),
    JWT_ACCESS_SECRET: secret,
    ADMIN_JWT_ACCESS_SECRET: secret,
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(120),
    AUTH_THROTTLE_LIMIT: z.coerce.number().int().min(1).default(10),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.ADMIN_JWT_ACCESS_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_JWT_ACCESS_SECRET'], message: 'must differ from JWT_ACCESS_SECRET' })
    }
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'ADMIN_JWT_ACCESS_SECRET'] as const) {
        if (env[key].startsWith('change-me')) ctx.addIssue({ code: 'custom', path: [key], message: 'still has the example value' })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

/** Injection token for the validated environment. */
export const ENV = Symbol('ENV')

/** Parses process.env once at startup and exits with a readable list of problems if it is invalid. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Invalid environment in .env (see .env.example):\n${problems}`)
  }
  return result.data
}
