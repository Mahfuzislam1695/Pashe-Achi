import { createVerify, generateKeyPairSync } from 'node:crypto'

import { type Env, loadEnv } from '../config/env'
import { createFcmSender, type FcmMessage, serviceAccountAssertion } from './fcm.sender'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const account = { projectId: 'kingfisher-test', clientEmail: 'push@kingfisher-test.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
const keyFile = { type: 'service_account', project_id: account.projectId, client_email: account.clientEmail, private_key: account.privateKey }

const envWith = (FCM_SERVICE_ACCOUNT: string): Env =>
  loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_ACCESS_SECRET: 'a'.repeat(40), ADMIN_JWT_ACCESS_SECRET: 'b'.repeat(40), FCM_SERVICE_ACCOUNT })

const message = { token: 'tok', notification: { title: 'T', body: 'B' }, data: {} } as unknown as FcmMessage
const json = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('FCM sender', () => {
  it('signs the service-account JWT that Google trades for an access token', () => {
    const jwt = serviceAccountAssertion(account, 1_700_000_000)
    const [header, claims, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    })
    expect(createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, signature!, 'base64url')).toBe(true)
  })

  it('is off without a service account', () => {
    expect(createFcmSender(envWith(''))).toBeNull()
  })

  it('gets one access token, reuses it, and posts to the project', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return url.includes('oauth2') ? json(200, { access_token: 'ya29.token', expires_in: 3600 }) : json(200, { name: 'projects/kingfisher-test/messages/1' })
    }) as unknown as typeof fetch
    const send = createFcmSender(envWith(Buffer.from(JSON.stringify(keyFile)).toString('base64')), fake)!

    await send(message)
    await send(message)
    expect(calls.map(call => call.url)).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://fcm.googleapis.com/v1/projects/kingfisher-test/messages:send',
      'https://fcm.googleapis.com/v1/projects/kingfisher-test/messages:send',
    ])
    expect(new Headers(calls[1]!.init.headers).get('authorization')).toBe('Bearer ya29.token')
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ message })
  })

  it("reports FCM's reason, so the channel can forget an uninstalled app", async () => {
    const fake = (async (url: string) =>
      url.includes('oauth2')
        ? json(200, { access_token: 'ya29.token', expires_in: 3600 })
        : json(404, { error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } })) as unknown as typeof fetch
    const send = createFcmSender(envWith(JSON.stringify(keyFile)), fake)!
    await expect(send(message)).rejects.toMatchObject({ statusCode: 404, errorCode: 'UNREGISTERED' })
  })
})
