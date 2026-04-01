// Admiralty Handbook — Service Worker
// Place this file in the same folder as admiralty_handbook_final.html
// Requires HTTPS or localhost to register (browsers block SW on file://)

var CACHE = "admiralty-v3";

var CORE = [
  "./admiralty_handbook_final.html",
  "./",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap"
];

// ── Install: cache core assets ────────────────────────────────────────
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // Cache what we can — ignore individual failures
      return Promise.all(CORE.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn("SW: could not cache", url, err.message);
        });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate: clear old caches ────────────────────────────────────────
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first for app, network-first for live weather ────────
self.addEventListener("fetch", function(e) {
  var url = e.request.url;

  // Live weather APIs — always try network, graceful offline fallback
  var isLiveAPI = url.includes("open-meteo.com") ||
                  url.includes("marine-api.open-meteo.com") ||
                  url.includes("geocoding-api.open-meteo.com");

  if (isLiveAPI) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(
          JSON.stringify({ error: true, reason: "offline" }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Google Fonts — network first, cache fallback (fonts load slowly)
  var isFonts = url.includes("fonts.googleapis.com") ||
                url.includes("fonts.gstatic.com");

  if (isFonts) {
    e.respondWith(
      fetch(e.request).then(function(r) {
        if (r && r.ok) {
          var clone = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return r;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Everything else — cache first, network fallback, cache any new responses
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(r) {
        if (r && r.ok && e.request.method === "GET") {
          var clone = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return r;
      }).catch(function() {
        // If completely offline and nothing cached, return a minimal response
        return new Response("Offline — open admiralty_handbook_final.html directly", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      });
    })
  );
});
