// Minimal service worker: lets alerts show on mobile and open the token when tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url;
  if (url) e.waitUntil(self.clients.openWindow(url));
});
