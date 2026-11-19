// Service worker: deixa o app instalável e funcionando offline.
// Estratégia "stale-while-revalidate": responde na hora com o cache e atualiza em segundo plano.
// Ao publicar uma versão nova, mude CACHE_VERSION para limpar os caches antigos.
const CACHE_VERSION = 'contador-v1';
const scope = self.registration.scope;
const INDEX_URL = new URL('./index.html', scope).href;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './fonts/open-sans-latin-300.woff2',
  './fonts/open-sans-latin-600.woff2',
].map((path) => new URL(path, scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// A página envia os arquivos que ela já carregou, para entrarem no cache na primeira visita.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS') return;
  const urls = (event.data.urls || []).filter((url) => url.startsWith(self.location.origin));
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(urls).catch(() => undefined)),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Toda navegação usa o mesmo index.html em cache, mesmo com ?min=0&max=100 na URL.
  // A chave é sempre uma URL simples (e não o objeto Request): assim cabeçalhos da requisição,
  // como o Origin que o navegador envia em scripts com `crossorigin`, não fazem o cache achar que
  // é outra resposta quando o servidor responde com "Vary: Origin".
  const key = request.mode === 'navigate' ? INDEX_URL : request.url;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(key, { ignoreVary: true });

      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) ?? Response.error();
    })(),
  );
});
