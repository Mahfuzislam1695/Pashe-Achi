import { SOCKET_NAMESPACE } from '@/shared'
import { io, type Socket } from 'socket.io-client'

import type { HttpClient } from './http'

/** Must match UNAUTHORIZED in src/server/notifications/notifications.gateway.ts. */
const UNAUTHORIZED = 'unauthorized'

/**
 * Connects to the API's Socket.IO namespace, on the same server and port as the page, with the
 * session cookie. When the handshake is refused because the access token expired, it refreshes the
 * session and reconnects (a few times at most, so a logged-out browser doesn't loop).
 */
export function connectRealtime(http: HttpClient): Socket {
  const socket = io(SOCKET_NAMESPACE, {
    withCredentials: true,
    auth: { audience: http.audience },
    transports: ['websocket', 'polling'],
  })

  let attempts = 0
  socket.on('connect', () => {
    attempts = 0
  })
  socket.on('connect_error', async error => {
    if (error.message !== UNAUTHORIZED || attempts++ >= 3) return
    if (await http.refresh()) socket.connect()
  })
  return socket
}

export type { Socket }
