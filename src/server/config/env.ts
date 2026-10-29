import { z } from 'zod'

const secret = z.string().min(32, 'must be at least 32 characters')

/** What the FCM sender needs from a Firebase service-account key. */
export interface ServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

/**
 * FCM_SERVICE_ACCOUNT: the service-account key file Firebase gives you (Project settings → Service
 * accounts → Generate new private key), pasted as JSON or as that JSON in base64. Null if it is neither.
 */
export function parseServiceAccount(value: string): ServiceAccount | null {
  const raw = value.trim()
  try {
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')) as Record<string, unknown>
    const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = json
    if (typeof projectId !== 'string' || !projectId || typeof clientEmail !== 'string' || !clientEmail.includes('@')) return null
    if (typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) return null
    // A key whose newlines arrive escaped (\n) still works.
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

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
    // Web Push (phone and desktop notifications). All empty: push is off.
    VAPID_PUBLIC_KEY: z.string().trim().regex(/^[A-Za-z0-9_-]{87}$/, 'must be the public key from `npx web-push generate-vapid-keys`').optional().or(z.literal('')),
    VAPID_PRIVATE_KEY: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, 'must be the private key from `npx web-push generate-vapid-keys`').optional().or(z.literal('')),
    VAPID_SUBJECT: z.string().trim().regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, 'must be mailto:you@yourdomain or an https:// URL').optional().or(z.literal('')),
    // Push to the Kingfisher app's phones (Firebase Cloud Messaging). Empty: off.
    FCM_SERVICE_ACCOUNT: z.string().trim().optional().or(z.literal('')),
    // The PostgreSQL client's pg_dump, for the System page's database backup. A full path when it isn't on PATH.
    PG_DUMP_PATH: z.string().trim().min(1).default('pg_dump'),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.ADMIN_JWT_ACCESS_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_JWT_ACCESS_SECRET'], message: 'must differ from JWT_ACCESS_SECRET' })
    }
    if (!!env.VAPID_PUBLIC_KEY !== !!env.VAPID_PRIVATE_KEY) {
      ctx.addIssue({ code: 'custom', path: [env.VAPID_PUBLIC_KEY ? 'VAPID_PRIVATE_KEY' : 'VAPID_PUBLIC_KEY'], message: 'set both VAPID keys, or neither' })
    }
    if (env.VAPID_PUBLIC_KEY && !env.VAPID_SUBJECT) {
      ctx.addIssue({ code: 'custom', path: ['VAPID_SUBJECT'], message: 'required with the VAPID keys (mailto:you@yourdomain)' })
    }
    if (env.FCM_SERVICE_ACCOUNT && !parseServiceAccount(env.FCM_SERVICE_ACCOUNT)) {
      ctx.addIssue({ code: 'custom', path: ['FCM_SERVICE_ACCOUNT'], message: 'must be the Firebase service-account key: its JSON, or that JSON in base64' })
    }
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'ADMIN_JWT_ACCESS_SECRET'] as const) {
        if (env[key].startsWith('change-me')) ctx.addIssue({ code: 'custom', path: [key], message: 'still has the example value' })
      }
      if (env.VAPID_PUBLIC_KEY && env.VAPID_SUBJECT?.includes('example.com')) {
        ctx.addIssue({ code: 'custom', path: ['VAPID_SUBJECT'], message: 'still has the example value' })
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
