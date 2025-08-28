const CACHE_NAME = "Finance-Tracker-Offline-Cache-v1";
const HASH_STORAGE_KEY = 'file-hashes';

// Files to cache initially
const URLS_TO_CACHE = [
  "/index.html",
  "/favicon.png", 
  "/manifest.json",
  "/app.js",
  "/style.css",
];

// Files to monitor for hash changes
const MONITORED_FILES = ['/app.js', '/style.css'];

// Extract hash from file content
function extractHash(content) {
  const hashMatch = content.match(/\/\* HASH:([a-f0-9]+) \*\//);
  return hashMatch ? hashMatch[1] : null;
}

// Get stored hashes from cache
async function getStoredHashes() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(HASH_STORAGE_KEY);
  if (response) {
    return await response.json();
  }
  return {};
}

// Store hashes in cache
async function storeHashes(hashes) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    HASH_STORAGE_KEY, 
    new Response(JSON.stringify(hashes), {
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

// Check if files have been updated
async function checkForUpdates() {
  try {
    const storedHashes = await getStoredHashes();
    const currentHashes = {};
    let hasUpdates = false;

    // Fetch and check each monitored file
    for (const file of MONITORED_FILES) {
      try {
        const response = await fetch(file, { cache: 'no-cache' });
        const content = await response.text();
        const hash = extractHash(content);
        
        if (hash) {
          currentHashes[file] = hash;
          
          // Compare with stored hash
          if (storedHashes[file] !== hash) {
            console.log(`Hash changed for ${file}: ${storedHashes[file]} -> ${hash}`);
            hasUpdates = true;
          }
        }
      } catch (error) {
        console.warn(`Failed to check ${file}:`, error);
      }
    }

    if (hasUpdates) {
      console.log('Files updated, clearing cache and recaching...');
      await clearCache();
      await cacheFiles(); // Re-cache all files
      await storeHashes(currentHashes);
      
      // Notify clients about the update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_UPDATED' });
        });
      });
    } else {
      // Store hashes even if no updates (for first time)
      await storeHashes(currentHashes);
    }

    return hasUpdates;
  } catch (error) {
    console.error('Error checking for updates:', error);
    return false;
  }
}

// Cache all files
async function cacheFiles() {
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(URLS_TO_CACHE);
}

// Clear all caches except hash storage
async function clearCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  
  for (const request of requests) {
    if (!request.url.includes(HASH_STORAGE_KEY)) {
      await cache.delete(request);
    }
  }
}

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheFiles().then(() => {
      console.log('Initial files cached');
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      }),
      // Check for updates on activation
      checkForUpdates()
    ])
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Don't cache if response is not ok
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response to cache it
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback to cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match("/index.html");
        }
        throw new Error('Network unavailable and no cache available');
      });
    })
  );
});

// Periodic check for updates
let updateCheckInterval;

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'START_UPDATE_CHECK') {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
    }
    
    updateCheckInterval = setInterval(async () => {
      await checkForUpdates();
    }, 10 * 60 * 1000); // 10 minutes
    
  } else if (event.data && event.data.type === 'STOP_UPDATE_CHECK') {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
      updateCheckInterval = null;
    }
  } else if (event.data && event.data.type === 'FORCE_UPDATE_CHECK') {
    checkForUpdates();
  }
});

// Check for updates when coming back online
self.addEventListener('online', () => {
  checkForUpdates();
});
