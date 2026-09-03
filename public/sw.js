const CACHE_PREFIX = "bearfit-static-"
const CACHE_NAME = "bearfit-static-v2"
const PRECACHE_URLS = [
  "/icons/bearfit-orange-192.png",
  "/icons/bearfit-orange-512.png",
  "/icons/bearfit-orange-maskable-512.png",
  "/icons/bearfit-orange-apple-180.png",
  "/Bearfit-Logo.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function fetchFromNetwork(request) {
  return fetch(request)
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const pathname = url.pathname
  const isPrivateOrDynamic =
    request.mode === "navigate" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/member/") ||
    pathname.startsWith("/staff/") ||
    pathname === "/payments" ||
    pathname === "/checkin"

  if (isPrivateOrDynamic) {
    event.respondWith(fetchFromNetwork(request))
    return
  }

  const isStaticAsset =
    PRECACHE_URLS.includes(pathname) || pathname.startsWith("/_next/static/")

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (!response || !response.ok) return response

        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
    })
  )
})
