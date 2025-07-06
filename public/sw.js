// Simple service worker to prevent 404 errors
// This is a minimal service worker that doesn't do anything special
// but prevents the browser from throwing 404 errors when looking for it

self.addEventListener("install", function (event) {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// Simple fetch handler that just passes through all requests
self.addEventListener("fetch", function (event) {
  // Let all requests pass through normally
  return;
});
