/**
 * Registra o service worker (modo offline).
 *
 * Os arquivos carregados na primeira visita passaram pela página antes do service worker
 * assumir o controle, então eles são enviados a ele para entrar no cache.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(window.location.origin));
        registration.active?.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(() => {
        /* sem modo offline, mas o app continua funcionando normalmente */
      });
  });
}
