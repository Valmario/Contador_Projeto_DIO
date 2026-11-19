import './styles.css';
import { bootApp } from './app';
import { registerServiceWorker } from './pwa';

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // acessar localStorage pode lançar exceção quando está bloqueado
  }
}

function replaceQuery(query: string): void {
  try {
    const { pathname, search, hash } = window.location;
    if (search !== query) window.history.replaceState(null, '', `${pathname}${query}${hash}`);
  } catch {
    /* ambientes que bloqueiam a History API: a URL só não é atualizada */
  }
}

bootApp(document, {
  storage: getStorage(),
  search: window.location.search,
  replaceQuery,
});

if (import.meta.env.PROD) registerServiceWorker();
