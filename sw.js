// Shell cache for offline open; data JSON is always network-first.
const C = "lbdesk-v2", SHELL = ["./", "index.html", "app.css", "app.js", "chart.js", "vapid.js", "manifest.json", "icons/icon-192.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.pathname.includes("/d/") || u.pathname.includes("/api/")) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
self.addEventListener("push", e => { const d = e.data ? e.data.json() : { title: "LB Desk", body: "" };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, data: d.url, icon: "icons/icon-192.png" })); });
self.addEventListener("notificationclick", e => { e.notification.close(); if (e.notification.data) e.waitUntil(clients.openWindow(e.notification.data)); });
