import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootApp, type App } from '../../src/app';

/** Armazenamento em memória com a mesma interface do localStorage. */
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  };
}

let current: App | null = null;

/** Remove os ouvintes do app anterior. Chame em `afterEach`. */
export function cleanupPage(): void {
  current?.destroy();
  current = null;
}

interface BootOptions {
  /** `null` simula o armazenamento bloqueado. */
  storage?: Storage | null;
  search?: string;
}

/** Carrega o HTML real do projeto no jsdom e liga o app a ele. */
export function bootPage(options: BootOptions = {}) {
  cleanupPage();

  const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';

  const storage = options.storage === undefined ? createMemoryStorage() : options.storage;
  const replaced: string[] = [];
  const app = bootApp(document, {
    storage,
    search: options.search ?? '',
    replaceQuery: (query) => replaced.push(query),
  });
  current = app;

  const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} não existe`);
    return element as T;
  };

  return {
    app,
    storage,
    replaced,
    $,
    value: () => $('value').textContent,
    click: (id: string) => $(id).click(),
    key(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
      );
    },
    /** Preenche o formulário de configurações e envia. */
    submitSettings(values: { name?: string; min?: string; max?: string; step?: string }) {
      const fields = {
        name: 'cfg-name',
        min: 'cfg-min',
        max: 'cfg-max',
        step: 'cfg-step',
      } as const;
      for (const [key, id] of Object.entries(fields)) {
        const value = values[key as keyof typeof fields];
        if (value !== undefined) $<HTMLInputElement>(id).value = value;
      }
      $('settings-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    },
    chips: () => [
      ...document.querySelectorAll<HTMLButtonElement>('#counters .chip:not(.chip-add)'),
    ],
  };
}
