import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHoldRepeat } from '../../src/ui/holdRepeat';

function setup(action: () => boolean) {
  const button = document.createElement('button');
  document.body.append(button);
  const detach = attachHoldRepeat(button, action);
  const fire = (type: string, init: MouseEventInit = {}) =>
    button.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...init }));
  return { button, detach, fire };
}

describe('attachHoldRepeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('executa uma vez ao pressionar e só repete depois do atraso inicial', () => {
    const action = vi.fn(() => true);
    const { fire } = setup(action);

    fire('pointerdown');
    expect(action).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(399);
    expect(action).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('acelera a repetição, sem passar do intervalo mínimo', () => {
    const times: number[] = [];
    const { fire } = setup(() => {
      times.push(Date.now());
      return true;
    });

    fire('pointerdown');
    vi.advanceTimersByTime(5000);

    const gaps = times.slice(2).map((time, i) => time - (times[i + 1] ?? 0));
    expect(gaps.length).toBeGreaterThan(10);
    expect(gaps[0]).toBeGreaterThan(gaps[5] ?? 0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(40);
    expect(gaps.at(-1)).toBe(40);
  });

  it('para ao soltar o botão', () => {
    const action = vi.fn(() => true);
    const { fire } = setup(action);

    fire('pointerdown');
    vi.advanceTimersByTime(600);
    const calls = action.mock.calls.length;
    fire('pointerup');
    vi.advanceTimersByTime(5000);
    expect(action).toHaveBeenCalledTimes(calls);
  });

  it('para ao sair de cima do botão ou cancelar o toque', () => {
    for (const type of ['pointerleave', 'pointercancel']) {
      const action = vi.fn(() => true);
      const { fire, detach } = setup(action);
      fire('pointerdown');
      fire(type);
      vi.advanceTimersByTime(5000);
      expect(action).toHaveBeenCalledTimes(1);
      detach();
    }
  });

  it('para sozinho quando a ação não muda mais nada (ex.: limite)', () => {
    let remaining = 3;
    const action = vi.fn(() => remaining-- > 0);
    const { fire } = setup(action);

    fire('pointerdown');
    vi.advanceTimersByTime(10_000);
    expect(action).toHaveBeenCalledTimes(4);
  });

  it('não repete se a primeira ação já não mudou nada', () => {
    const action = vi.fn(() => false);
    const { fire } = setup(action);
    fire('pointerdown');
    vi.advanceTimersByTime(10_000);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('ignora botões que não são o principal do mouse e botões desabilitados', () => {
    const action = vi.fn(() => true);
    const { button, fire } = setup(action);

    fire('pointerdown', { button: 2 });
    expect(action).not.toHaveBeenCalled();

    button.disabled = true;
    fire('pointerdown');
    expect(action).not.toHaveBeenCalled();
  });

  it('o teclado (click com detail 0) executa uma vez; o clique do mouse não duplica', () => {
    const action = vi.fn(() => true);
    const { fire } = setup(action);

    fire('click', { detail: 0 });
    expect(action).toHaveBeenCalledTimes(1);

    fire('pointerdown');
    fire('pointerup');
    fire('click', { detail: 1 });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('detach remove os ouvintes e cancela a repetição em andamento', () => {
    const action = vi.fn(() => true);
    const { fire, detach } = setup(action);

    fire('pointerdown');
    detach();
    vi.advanceTimersByTime(5000);
    expect(action).toHaveBeenCalledTimes(1);

    fire('pointerdown');
    fire('click', { detail: 0 });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
