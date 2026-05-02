self.addEventListener('push', event => {
  const data  = event.data?.json() ?? {}
  const total = data.total ? `\n💰 ₹${parseFloat(data.total).toFixed(0)}` : ''
  const title = data.title ?? '🛒 New Order Received!'
  const body  = data.body
    ?? `📦 ${data.preview || 'New order placed'}${total}\n👆 Tap to open Orders`
  const options = {
    body,
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     'new-order',
    requireInteraction: true,
    actions: [
      { action: 'view',    title: '📋 View Orders' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: { url: self.location.origin + '/orders' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'dismiss') return
  // 'view' action or direct click → open/focus orders page
  const target = event.notification.data?.url ?? self.location.origin + '/orders'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); return }
      return clients.openWindow(target)
    })
  )
})
