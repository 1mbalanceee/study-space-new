const CACHE_NAME = 'study-os-v3';
const STATIC_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Установка — кэшируем только статические файлы (без редиректов)
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
  
  // Игнорируем сторонние запросы (шрифты Google и т.д.)
  if (!request.url.startsWith(self.location.origin)) {
    // Для сторонних — просто делаем fetch без кэша
    return;
  }
  
  // Для навигационных запросов (открытие страницы)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // Для всех остальных GET запросов — cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      
      return fetch(request).then(response => {
        // НЕ кэшируем если:
        // - ответ не успешный
        // - это редирект
        // - это не базовый тип ответа
        if (
          !response ||
          response.status !== 200 ||
          response.type !== 'basic' ||
          response.redirected
        ) {
          return response;
        }
        
        // Клонируем и кэшируем
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, clone);
        });
        
        return response;
      }).catch(() => {
        // Если офлайн и нет в кэше — для HTML возвращаем index.html
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});