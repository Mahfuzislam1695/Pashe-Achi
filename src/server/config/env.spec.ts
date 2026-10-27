import { loadEnv, parseServiceAccount } from './env'

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  ADMIN_JWT_ACCESS_SECRET: 'b'.repeat(40),
}

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.ACCESS_TOKEN_TTL_MINUTES).toBe(15)
    expect(env.UPLOAD_DIR).toBe('uploads')
  })

  it('lists every problem at once', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET[\s\S]*ADMIN_JWT_ACCESS_SECRET/)
  })

  it('rejects short or shared secrets', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(/at least 32/)
    expect(() => loadEnv({ ...valid, ADMIN_JWT_ACCESS_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(/must differ/)
  })

  it('refuses the example secrets in production', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'change-me-customer-access-secret-at-least-32-chars' })).toThrow(/example value/)
  })

  it('takes both VAPID keys and a subject for push, or none of them', () => {
    const vapid = { VAPID_PUBLIC_KEY: 'B'.repeat(87), VAPID_PRIVATE_KEY: 'k'.repeat(43), VAPID_SUBJECT: 'mailto:ops@kingfisher.com.bd' }
    expect(loadEnv({ ...valid, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' }).VAPID_PUBLIC_KEY).toBe('')
    expect(loadEnv({ ...valid, ...vapid }).VAPID_SUBJECT).toBe(vapid.VAPID_SUBJECT)
    expect(() => loadEnv({ ...valid, VAPID_PUBLIC_KEY: vapid.VAPID_PUBLIC_KEY })).toThrow(/VAPID_PRIVATE_KEY: set both/)
    expect(() => loadEnv({ ...valid, ...vapid, VAPID_SUBJECT: '' })).toThrow(/VAPID_SUBJECT: required/)
    expect(() => loadEnv({ ...valid, ...vapid, VAPID_PUBLIC_KEY: 'short' })).toThrow(/VAPID_PUBLIC_KEY/)
    expect(() => loadEnv({ ...valid, ...vapid, NODE_ENV: 'production', VAPID_SUBJECT: 'mailto:admin@example.com' })).toThrow(/VAPID_SUBJECT: still has the example value/)
  })

  it('takes the Firebase service-account key as JSON or base64 for push to the app', () => {
    const key = { type: 'service_account', project_id: 'kingfisher-bd', client_email: 'push@kingfisher-bd.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n' }
    expect(loadEnv(valid).FCM_SERVICE_ACCOUNT).toBeUndefined()
    expect(parseServiceAccount(JSON.stringify(key))).toEqual({
      projectId: 'kingfisher-bd',
      clientEmail: 'push@kingfisher-bd.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n',
    })
    expect(parseServiceAccount(Buffer.from(JSON.stringify(key)).toString('base64'))?.projectId).toBe('kingfisher-bd')
    expect(loadEnv({ ...valid, FCM_SERVICE_ACCOUNT: Buffer.from(JSON.stringify(key)).toString('base64') }).FCM_SERVICE_ACCOUNT).toBeTruthy()
    expect(() => loadEnv({ ...valid, FCM_SERVICE_ACCOUNT: 'not a key' })).toThrow(/FCM_SERVICE_ACCOUNT: must be the Firebase service-account key/)
    expect(() => loadEnv({ ...valid, FCM_SERVICE_ACCOUNT: JSON.stringify({ ...key, private_key: 'nope' }) })).toThrow(/FCM_SERVICE_ACCOUNT/)
  })
})
