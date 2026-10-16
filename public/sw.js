// Phone and desktop notifications (Web Push) for the customer site and the admin panel.
// Registered by src/api-client/push.ts with scope "/". It has no fetch handler: pages load exactly
// as without it. Messages come from src/server/notifications/web-push.channel.ts as
// { title, body, url, tag, area, lang }.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

/** Admin pages are under /admin; everything else is the customer site. */
const areaOf = url => (new URL(url).pathname.startsWith('/admin') ? 'admin' : 'customer')

const windowsOf = async area =>
  (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => areaOf(client.url) === area)

self.addEventListener('push', event => {
  let message
  try {
    message = event.data ? event.data.json() : null
  } catch {
    message = null
  }
  if (!message || !message.title) return

  event.waitUntil(
    (async () => {
      // Someone looking at that side of the site right now already sees the live toast.
      const open = await windowsOf(message.area)
      if (open.some(client => client.focused && client.visibilityState === 'visible')) return
      await self.registration.showNotification(message.title, {
        body: message.body,
        icon: '/icon-192x192.png',
        tag: message.tag,
        renotify: Boolean(message.tag),
        lang: message.lang,
        data: { url: message.url, area: message.area },
      })
    })(),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { url = '/', area = 'customer' } = event.notification.data || {}
  const target = new URL(url, self.location.origin).href

  event.waitUntil(
    (async () => {
      for (const client of await windowsOf(area)) {
        try {
          await client.focus()
          await client.navigate(target)
          return
        } catch {
          // Not controlled by this worker yet (opened before it installed): open a new window.
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
