/* global self, caches, __PRECACHE__ */
// Sudocode's service worker, written by hand (no library). The build fills in the file list and the version below.
// Compiler-article note: this is a *cache-first resolver*, like a linker's symbol table: every known URL maps
// to a stored response, and anything unknown falls through to the network.
//
// It does two jobs: (1) after the first visit the whole app is stored, so it loads offline; (2) every response
// it hands out carries the COOP/COEP headers, so the page stays cross-origin isolated even when the answer
// comes from the cache rather than from Cloudflare.
const CACHE = "sudocode-__VERSION__";
const PRECACHE = __PRECACHE__;
const ISOLATION = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/** The same response with the isolation headers added (a Response's headers are read-only, so copy it). */
function isolated(response) {
  if (response.status === 0 || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(ISOLATION)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Cross-origin (the Google Fonts stylesheet) is left to the browser; offline the editor falls back to monospace.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = request.mode === "navigate" ? "/index.html" : request;
      const cached = await cache.match(key, { ignoreSearch: request.mode === "navigate" });
      if (cached !== undefined) return isolated(cached);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(request, fresh.clone());
        return isolated(fresh);
      } catch {
        const shell = await cache.match("/index.html");
        if (request.mode === "navigate" && shell !== undefined) return isolated(shell);
        return Response.error();
      }
    })(),
  );
});
