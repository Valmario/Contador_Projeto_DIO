import {
  DEFAULT_CONFIG,
  createCounter,
  getConfigError,
  type Counter,
  type CounterConfig,
} from './counter';

export const MAX_COUNTERS = 8;
export const MAX_NAME_LENGTH = 24;

export interface CounterEntry {
  readonly id: string;
  name: string;
  readonly counter: Counter;
}

/** Formato salvo no armazenamento do navegador. */
export interface PersistedState {
  v: 2;
  config: CounterConfig;
  counters: { id: string; name: string; value: number }[];
  activeId: string;
}

export interface Store {
  readonly config: Readonly<CounterConfig>;
  readonly entries: readonly CounterEntry[];
  readonly active: CounterEntry;
  /** Avisa sempre que algo muda. Devolve a função para cancelar. */
  subscribe(listener: () => void): () => void;

  select(id: string): void;
  add(): CounterEntry | null;
  remove(id: string): boolean;
  rename(id: string, name: string): void;
  /** Devolve a mensagem de erro, ou `null` se a configuração foi aplicada. */
  configure(config: Partial<CounterConfig>): string | null;

  increment(): boolean;
  decrement(): boolean;
  reset(): boolean;
  undo(): boolean;
  redo(): boolean;

  snapshot(): PersistedState;
}

function cleanName(raw: string): string {
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

export function createStore(initial?: PersistedState | null): Store {
  let config: CounterConfig = initial ? { ...initial.config } : { ...DEFAULT_CONFIG };
  const entries: CounterEntry[] = [];
  const listeners = new Set<() => void>();

  const makeEntry = (id: string, name: string, value: number): CounterEntry => ({
    id,
    name,
    counter: createCounter({ ...config, initial: value }),
  });

  if (initial) {
    for (const item of initial.counters.slice(0, MAX_COUNTERS)) {
      entries.push(makeEntry(item.id, cleanName(item.name) || item.id, item.value));
    }
  }
  if (entries.length === 0) entries.push(makeEntry('c1', 'Contador 1', 0));

  const find = (id: string): CounterEntry | undefined => entries.find((e) => e.id === id);

  /** Há sempre ao menos um contador; se isso falhar, é bug do store e queremos saber na hora. */
  const nth = (index: number): CounterEntry => {
    const entry = entries[index];
    if (!entry) throw new Error('O store precisa de ao menos um contador.');
    return entry;
  };

  let activeId = find(initial?.activeId ?? '')?.id ?? nth(0).id;
  const active = (): CounterEntry => find(activeId) ?? nth(0);

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  /** Executa uma ação no contador ativo e avisa os ouvintes se algo mudou. */
  const act = (action: (counter: Counter) => boolean): boolean => {
    const changed = action(active().counter);
    if (changed) notify();
    return changed;
  };

  function nextId(): string {
    const used = entries.map((e) => Number(/^c(\d+)$/.exec(e.id)?.[1] ?? 0));
    return `c${Math.max(0, ...used) + 1}`;
  }

  function nextName(): string {
    for (let n = entries.length + 1; ; n++) {
      const candidate = `Contador ${n}`;
      if (!entries.some((e) => e.name === candidate)) return candidate;
    }
  }

  return {
    get config() {
      return config;
    },
    get entries() {
      return entries;
    },
    get active() {
      return active();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    select(id) {
      if (id === activeId || !find(id)) return;
      activeId = id;
      notify();
    },
    add() {
      if (entries.length >= MAX_COUNTERS) return null;
      const entry = makeEntry(nextId(), nextName(), 0);
      entries.push(entry);
      activeId = entry.id;
      notify();
      return entry;
    },
    remove(id) {
      const index = entries.findIndex((e) => e.id === id);
      if (index === -1 || entries.length === 1) return false;
      entries.splice(index, 1);
      if (activeId === id) {
        activeId = nth(Math.min(index, entries.length - 1)).id;
      }
      notify();
      return true;
    },
    rename(id, name) {
      const entry = find(id);
      const cleaned = cleanName(name);
      if (!entry || !cleaned || cleaned === entry.name) return;
      entry.name = cleaned;
      notify();
    },
    configure(partial) {
      const next = { ...config, ...partial };
      const error = getConfigError(next);
      if (error) return error;
      config = next;
      for (const entry of entries) entry.counter.configure(config);
      notify();
      return null;
    },

    increment: () => act((c) => c.increment()),
    decrement: () => act((c) => c.decrement()),
    reset: () => act((c) => c.reset()),
    undo: () => act((c) => c.undo()),
    redo: () => act((c) => c.redo()),

    snapshot() {
      return {
        v: 2,
        config: { ...config },
        counters: entries.map((e) => ({ id: e.id, name: e.name, value: e.counter.value })),
        activeId: active().id,
      };
    },
  };
}
