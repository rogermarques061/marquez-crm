/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// SPA: qualquer rota (/painel/vendas/123 etc.) abre o app mesmo offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

interface Aviso {
  title: string
  body: string
  url?: string
  tag?: string
}

// Push enviado pela Edge Function notificar-venda
self.addEventListener('push', (evento) => {
  const aviso: Aviso = evento.data?.json() ?? { title: 'Marquez', body: 'Nova atualização' }
  evento.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      icon: '/pwa-192.png',
      badge: '/badge-96.png',
      tag: aviso.tag,
      data: { url: aviso.url ?? '/painel/vendas' },
    }),
  )
})

// Tocar na notificação abre direto a venda no painel
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL((evento.notification.data?.url as string) ?? '/painel', self.location.origin).href
  evento.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const app = abertas.find((c) => new URL(c.url).origin === self.location.origin)
      if (app) {
        await app.focus()
        return app.navigate(url)
      }
      return self.clients.openWindow(url)
    })(),
  )
})
