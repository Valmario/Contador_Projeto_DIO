import { describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  loadState,
  parsePersistedState,
  saveState,
} from '../../src/core/storage';
import type { PersistedState } from '../../src/core/store';
import { createMemoryStorage } from './helpers';

const valid: PersistedState = {
  v: 2,
  config: { min: 0, max: 100, step: 5 },
  counters: [
    { id: 'c1', name: 'A', value: 10 },
    { id: 'c2', name: 'B', value: 20 },
  ],
  activeId: 'c2',
};

describe('saveState / loadState', () => {
  it('salva e carrega o mesmo estado', () => {
    const storage = createMemoryStorage();
    saveState(storage, valid);
    expect(loadState(storage)).toEqual(valid);
  });

  it('devolve null sem nada salvo ou sem armazenamento', () => {
    expect(loadState(createMemoryStorage())).toBeNull();
    expect(loadState(null)).toBeNull();
  });

  it('ignora JSON quebrado', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, '{quebrado');
    expect(loadState(storage)).toBeNull();
  });

  it('não lança exceção se o armazenamento estiver bloqueado', () => {
    const blocked = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(loadState(blocked)).toBeNull();
    expect(() => saveState(blocked, valid)).not.toThrow();
    expect(() => saveState(null, valid)).not.toThrow();
  });

  it('migra o formato antigo (só um número) para o novo', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, '7');
    const state = loadState(storage);
    expect(state?.counters).toEqual([{ id: 'c1', name: 'Contador 1', value: 7 }]);
    expect(state?.config).toEqual({ min: -10, max: 10, step: 1 });
  });

  it('prefere o formato novo ao antigo', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, '7');
    saveState(storage, valid);
    expect(loadState(storage)).toEqual(valid);
  });

  it('ignora o formato antigo quando não é número', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, 'lixo');
    expect(loadState(storage)).toBeNull();
  });
});

describe('parsePersistedState', () => {
  it('rejeita estruturas inválidas', () => {
    const invalid: unknown[] = [
      null,
      'texto',
      42,
      {},
      { ...valid, v: 1 },
      { ...valid, config: { min: 5, max: 5, step: 1 } },
      { ...valid, config: { min: 'a', max: 5, step: 1 } },
      { ...valid, config: null },
      { ...valid, counters: [] },
      { ...valid, counters: 'x' },
      { ...valid, counters: [{ id: 'c1', name: 'A', value: 1.5 }] },
      { ...valid, counters: [{ id: 1, name: 'A', value: 1 }] },
      {
        ...valid,
        counters: [
          { id: 'c1', name: 'A', value: 1 },
          { id: 'c1', name: 'B', value: 2 },
        ],
      },
      { ...valid, activeId: 3 },
    ];
    for (const raw of invalid) expect(parsePersistedState(raw)).toBeNull();
  });

  it('aceita um estado válido', () => {
    expect(parsePersistedState(valid)).toEqual(valid);
  });
});
