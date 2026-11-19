import { describe, expect, it, vi } from 'vitest';
import { MAX_COUNTERS, MAX_NAME_LENGTH, createStore } from '../../src/core/store';

describe('createStore', () => {
  it('começa com um contador ativo', () => {
    const store = createStore();
    expect(store.entries).toHaveLength(1);
    expect(store.active.name).toBe('Contador 1');
    expect(store.config).toEqual({ min: -10, max: 10, step: 1 });
  });

  it('as ações valem para o contador ativo e avisam os ouvintes', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.increment()).toBe(true);
    expect(store.active.counter.value).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('não avisa os ouvintes quando nada mudou', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
    expect(store.reset()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe devolve a função que cancela o ouvinte', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.increment();
    expect(listener).not.toHaveBeenCalled();
  });

  describe('vários contadores', () => {
    it('add cria um contador novo e o torna ativo', () => {
      const store = createStore();
      store.increment();
      const entry = store.add();

      expect(entry?.name).toBe('Contador 2');
      expect(store.active.id).toBe(entry?.id);
      expect(store.active.counter.value).toBe(0);
      expect(store.entries[0]?.counter.value).toBe(1);
    });

    it('cada contador tem valor e histórico próprios', () => {
      const store = createStore();
      store.increment();
      store.add();
      store.decrement();
      store.undo();
      expect(store.active.counter.value).toBe(0);
      store.select(store.entries[0]?.id ?? '');
      expect(store.active.counter.value).toBe(1);
      expect(store.active.counter.canUndo).toBe(true);
    });

    it('limita a quantidade de contadores', () => {
      const store = createStore();
      for (let i = 1; i < MAX_COUNTERS; i++) expect(store.add()).not.toBeNull();
      expect(store.entries).toHaveLength(MAX_COUNTERS);
      expect(store.add()).toBeNull();
    });

    it('remove o contador e escolhe um vizinho como ativo', () => {
      const store = createStore();
      store.add();
      store.add();
      const [first, second] = store.entries;
      store.select(second?.id ?? '');
      expect(store.remove(second?.id ?? '')).toBe(true);
      expect(store.entries).toHaveLength(2);
      expect(store.active.id).not.toBe(second?.id);
      expect(store.entries[0]).toBe(first);
    });

    it('não remove o último contador nem um id inexistente', () => {
      const store = createStore();
      expect(store.remove(store.active.id)).toBe(false);
      store.add();
      expect(store.remove('nao-existe')).toBe(false);
    });

    it('não repete ids nem nomes depois de remover e adicionar', () => {
      const store = createStore();
      store.add();
      store.add();
      store.remove(store.entries[1]?.id ?? '');
      store.add();
      const ids = store.entries.map((e) => e.id);
      const names = store.entries.map((e) => e.name);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(names).size).toBe(names.length);
    });

    it('select ignora ids inexistentes e o contador que já está ativo', () => {
      const store = createStore();
      const listener = vi.fn();
      store.subscribe(listener);
      store.select('nao-existe');
      store.select(store.active.id);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('renomeia, aparando espaços e limitando o tamanho', () => {
      const store = createStore();
      store.rename(store.active.id, '  Placar  ');
      expect(store.active.name).toBe('Placar');
      store.rename(store.active.id, 'x'.repeat(100));
      expect(store.active.name).toHaveLength(MAX_NAME_LENGTH);
    });

    it('ignora nomes vazios', () => {
      const store = createStore();
      store.rename(store.active.id, '   ');
      expect(store.active.name).toBe('Contador 1');
    });
  });

  describe('configure', () => {
    it('aplica a nova configuração a todos os contadores', () => {
      const store = createStore();
      store.increment();
      store.add();
      expect(store.configure({ min: 0, max: 100, step: 5 })).toBeNull();
      for (const entry of store.entries) {
        expect([entry.counter.min, entry.counter.max, entry.counter.step]).toEqual([0, 100, 5]);
      }
      expect(store.config).toEqual({ min: 0, max: 100, step: 5 });
    });

    it('devolve a mensagem de erro e não muda nada se for inválida', () => {
      const store = createStore();
      const listener = vi.fn();
      store.subscribe(listener);
      expect(store.configure({ min: 50 })).toMatch(/mínimo/i);
      expect(store.config.min).toBe(-10);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('snapshot', () => {
    it('guarda e restaura o estado', () => {
      const store = createStore();
      store.configure({ min: 0, max: 50, step: 5 });
      store.increment();
      store.add();
      store.rename(store.active.id, 'Placar');
      store.increment();
      store.increment();

      const restored = createStore(store.snapshot());
      expect(restored.config).toEqual({ min: 0, max: 50, step: 5 });
      expect(restored.entries.map((e) => [e.name, e.counter.value])).toEqual([
        ['Contador 1', 5],
        ['Placar', 10],
      ]);
      expect(restored.active.name).toBe('Placar');
    });

    it('ajusta valores salvos que ficaram fora do intervalo', () => {
      const store = createStore({
        v: 2,
        config: { min: 0, max: 10, step: 1 },
        counters: [{ id: 'c1', name: 'A', value: 999 }],
        activeId: 'c1',
      });
      expect(store.active.counter.value).toBe(10);
    });

    it('usa o primeiro contador se o ativo salvo não existir', () => {
      const store = createStore({
        v: 2,
        config: { min: 0, max: 10, step: 1 },
        counters: [{ id: 'c1', name: 'A', value: 1 }],
        activeId: 'fantasma',
      });
      expect(store.active.id).toBe('c1');
    });
  });
});
