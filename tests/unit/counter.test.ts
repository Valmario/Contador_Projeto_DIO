import { describe, expect, it } from 'vitest';
import {
  MAX_HISTORY,
  assertValidConfig,
  createCounter,
  getConfigError,
} from '../../src/core/counter';

describe('createCounter', () => {
  it('começa em 0, no intervalo -10..10 e passo 1', () => {
    const c = createCounter();
    expect([c.value, c.min, c.max, c.step]).toEqual([0, -10, 10, 1]);
    expect(c.isNegative).toBe(false);
  });

  it('soma e subtrai e informa se o valor mudou', () => {
    const c = createCounter();
    expect(c.increment()).toBe(true);
    expect(c.increment()).toBe(true);
    expect(c.decrement()).toBe(true);
    expect(c.value).toBe(1);
  });

  it('não passa do limite máximo nem do mínimo, mesmo com cliques extras', () => {
    const c = createCounter();
    for (let i = 0; i < 25; i++) c.increment();
    expect(c.value).toBe(10);
    expect(c.atMax).toBe(true);
    expect(c.increment()).toBe(false);

    for (let i = 0; i < 40; i++) c.decrement();
    expect(c.value).toBe(-10);
    expect(c.atMin).toBe(true);
    expect(c.decrement()).toBe(false);
  });

  // Regressão: na primeira versão o contador interno passava do limite
  // e, ao voltar, a tela mostrava 11 em vez de 9.
  it('voltar do limite dá o valor certo (sem "dívida" escondida)', () => {
    const c = createCounter();
    for (let i = 0; i < 12; i++) c.increment();
    c.decrement();
    expect(c.value).toBe(9);
  });

  it('isNegative só é verdadeiro abaixo de zero', () => {
    const c = createCounter();
    c.decrement();
    expect(c.isNegative).toBe(true);
    c.increment();
    expect(c.isNegative).toBe(false);
  });

  it('progress vai de 0 (mínimo) a 1 (máximo)', () => {
    const c = createCounter();
    c.set(-10);
    expect(c.progress).toBe(0);
    c.set(0);
    expect(c.progress).toBe(0.5);
    c.set(10);
    expect(c.progress).toBe(1);
  });

  it('aceita intervalo, valor inicial e passo personalizados', () => {
    const c = createCounter({ min: 0, max: 100, initial: 50, step: 25 });
    c.increment();
    expect(c.value).toBe(75);
    c.increment();
    c.increment();
    expect(c.value).toBe(100);
  });

  it('ajusta o valor inicial ao intervalo', () => {
    expect(createCounter({ initial: 500 }).value).toBe(10);
    expect(createCounter({ initial: -500 }).value).toBe(-10);
  });

  it('set ajusta valores fora do intervalo e rejeita não inteiros', () => {
    const c = createCounter();
    c.set(99);
    expect(c.value).toBe(10);
    expect(() => c.set(1.5)).toThrow(TypeError);
    expect(() => c.set(Number.NaN)).toThrow(TypeError);
  });

  it('reset volta para zero (ou para o mínimo, se zero estiver fora do intervalo)', () => {
    const a = createCounter({ initial: 7 });
    a.reset();
    expect(a.value).toBe(0);

    const b = createCounter({ min: 5, max: 20, initial: 9 });
    b.reset();
    expect(b.value).toBe(5);
  });
});

describe('histórico (desfazer e refazer)', () => {
  it('desfaz e refaz na ordem certa', () => {
    const c = createCounter();
    c.increment();
    c.increment();
    c.increment();
    expect(c.undo()).toBe(true);
    expect(c.value).toBe(2);
    expect(c.undo()).toBe(true);
    expect(c.value).toBe(1);
    expect(c.redo()).toBe(true);
    expect(c.value).toBe(2);
  });

  it('começa sem histórico e informa canUndo/canRedo', () => {
    const c = createCounter();
    expect([c.canUndo, c.canRedo]).toEqual([false, false]);
    expect(c.undo()).toBe(false);
    expect(c.redo()).toBe(false);
    c.increment();
    expect([c.canUndo, c.canRedo]).toEqual([true, false]);
    c.undo();
    expect([c.canUndo, c.canRedo]).toEqual([false, true]);
  });

  it('uma ação que não muda o valor não entra no histórico', () => {
    const c = createCounter({ initial: 10 });
    c.increment();
    c.increment();
    expect(c.canUndo).toBe(false);
  });

  it('uma ação nova depois de desfazer descarta o "refazer"', () => {
    const c = createCounter();
    c.increment();
    c.increment();
    c.undo();
    c.decrement();
    expect(c.canRedo).toBe(false);
    expect(c.value).toBe(0);
  });

  it('guarda no máximo MAX_HISTORY ações', () => {
    const c = createCounter({ min: -1000, max: 1000 });
    for (let i = 0; i < MAX_HISTORY + 50; i++) c.increment();
    let undone = 0;
    while (c.undo()) undone++;
    expect(undone).toBe(MAX_HISTORY);
    expect(c.value).toBe(50);
  });

  it('reset também pode ser desfeito', () => {
    const c = createCounter({ initial: 6 });
    c.reset();
    c.undo();
    expect(c.value).toBe(6);
  });
});

describe('configure', () => {
  it('troca limites e passo, reajusta o valor e limpa o histórico', () => {
    const c = createCounter({ initial: 8 });
    c.decrement();
    c.configure({ min: 0, max: 5, step: 2 });
    expect([c.min, c.max, c.step]).toEqual([0, 5, 2]);
    expect(c.value).toBe(5);
    expect(c.canUndo).toBe(false);
  });

  it('mantém o estado se a nova configuração for inválida', () => {
    const c = createCounter({ initial: 3 });
    expect(() => c.configure({ min: 20 })).toThrow(RangeError);
    expect([c.min, c.max, c.value]).toEqual([-10, 10, 3]);
  });
});

describe('validação de configuração', () => {
  it('rejeita valores inválidos com o tipo de erro certo', () => {
    expect(() => assertValidConfig({ min: 5, max: 5, step: 1 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 10, max: -10, step: 1 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 0, max: 10, step: 0 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 0, max: 10, step: -1 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 0, max: 10, step: 11 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 0, max: 2_000_000, step: 1 })).toThrow(RangeError);
    expect(() => assertValidConfig({ min: 0, max: 1.5, step: 1 })).toThrow(TypeError);
    expect(() => assertValidConfig({ min: 0, max: Number.NaN, step: 1 })).toThrow(TypeError);
  });

  it('createCounter rejeita configuração e valor inicial inválidos', () => {
    expect(() => createCounter({ min: 5, max: 5 })).toThrow(RangeError);
    expect(() => createCounter({ initial: 1.5 })).toThrow(TypeError);
  });

  it('getConfigError devolve a mensagem ou null', () => {
    expect(getConfigError({ min: -10, max: 10, step: 1 })).toBeNull();
    expect(getConfigError({ min: 10, max: 0, step: 1 })).toMatch(/mínimo/i);
  });
});
