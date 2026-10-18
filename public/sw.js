/* Push only: account pages, photos and health data are never cached offline. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* Show a useful fallback. */ }
  if (!payload || typeof payload !== "object") payload = {};
  const title = typeof payload.title === "string" ? payload.title.slice(0, 100) : "+1lean";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 200) : "There is new activity from your community.";
  let url;
  try { url = new URL(typeof payload.url === "string" ? payload.url : "/", self.location.origin); }
  catch { url = new URL("/", self.location.origin); }
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icons/lean-192.png",
    badge: "/icons/notification-badge.png",
    tag: typeof payload.tag === "string" ? payload.tag : "roblox-activity",
    data: { url: url.origin === self.location.origin ? url.href : self.location.origin + "/" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  let target;
  try { target = new URL(event.notification.data?.url || "/", self.location.origin); }
  catch { target = new URL("/", self.location.origin); }
  if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try { await client.navigate(target.href); return await client.focus(); } catch { /* Try another window. */ }
    }
    return self.clients.openWindow(target.href);
  })());
});
