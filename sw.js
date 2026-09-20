const CACHE_NAME = 'study-os-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Установка — кэшируем статические файлы
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Не удалось закэшировать все ресурсы:', err);
      });
    })
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Игнорируем не-GET запросы
  if (request.method !== 'GET') return;
  
  // Кэшируем CDN ресурсы (шрифты Google, скрипты Firebase для надежного офлайна)
  const isCdnAsset = 
    request.url.startsWith('https://www.gstatic.com/firebasejs/') ||
    request.url.startsWith('https://fonts.googleapis.com/') ||
    request.url.startsWith('https://fonts.gstatic.com/');

  if (isCdnAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  // Для сторонних — делаем fetch без кэша
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Для навигационных запросов (открытие страницы)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  
  // Для остальных запросов — cache first со fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      
      return fetch(request).then(response => {
        if (
          !response ||
          response.status !== 200 ||
          response.type !== 'basic' ||
          response.redirected
        ) {
          return response;
        }
        
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, clone);
        });
        
        return response;
      }).catch(() => {
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});