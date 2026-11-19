import { DEFAULT_CONFIG, getConfigError, type CounterConfig } from './counter';
import { MAX_COUNTERS, type PersistedState } from './store';

export const STORAGE_KEY = 'contador-dio:v2';
/** Chave usada pela versão antiga, que guardava só um número. */
export const LEGACY_STORAGE_KEY = 'contador-dio:v1';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Valida o que veio do armazenamento. Devolve `null` se não for confiável. */
export function parsePersistedState(raw: unknown): PersistedState | null {
  if (!isRecord(raw) || raw.v !== 2) return null;

  const { config, counters, activeId } = raw;
  if (!isRecord(config) || !Array.isArray(counters) || typeof activeId !== 'string') return null;

  const parsedConfig: CounterConfig = {
    min: config.min as number,
    max: config.max as number,
    step: config.step as number,
  };
  if (getConfigError(parsedConfig) !== null) return null;

  const items: PersistedState['counters'] = [];
  for (const item of counters.slice(0, MAX_COUNTERS)) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      !Number.isInteger(item.value)
    ) {
      return null;
    }
    items.push({ id: item.id, name: item.name, value: item.value as number });
  }
  if (items.length === 0 || new Set(items.map((i) => i.id)).size !== items.length) return null;

  return { v: 2, config: parsedConfig, counters: items, activeId };
}

/** Carrega o estado salvo, migrando o formato antigo se for o caso. Nunca lança exceção. */
export function loadState(storage: ReadableStorage | null): PersistedState | null {
  if (!storage) return null;
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) {
      const parsed = parsePersistedState(JSON.parse(current));
      if (parsed) return parsed;
    }

    const legacy = Number.parseInt(storage.getItem(LEGACY_STORAGE_KEY) ?? '', 10);
    if (Number.isInteger(legacy)) {
      return {
        v: 2,
        config: { ...DEFAULT_CONFIG },
        counters: [{ id: 'c1', name: 'Contador 1', value: legacy }],
        activeId: 'c1',
      };
    }
  } catch {
    /* armazenamento bloqueado ou JSON quebrado: segue com o estado inicial */
  }
  return null;
}

/** Salva o estado. A persistência é um extra, então falhas são ignoradas. */
export function saveState(storage: WritableStorage | null, state: PersistedState): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* modo privado, cota cheia etc. */
  }
}
