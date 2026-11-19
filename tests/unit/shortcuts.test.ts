import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachShortcuts,
  isTypingTarget,
  resolveShortcut,
  type ShortcutHandlers,
} from '../../src/ui/shortcuts';

const key = (k: string, init: Partial<KeyboardEvent> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

describe('resolveShortcut', () => {
  it('mapeia as teclas para ações', () => {
    expect(resolveShortcut(key('ArrowUp'))).toBe('increment');
    expect(resolveShortcut(key('ArrowRight'))).toBe('increment');
    expect(resolveShortcut(key('ArrowDown'))).toBe('decrement');
    expect(resolveShortcut(key('ArrowLeft'))).toBe('decrement');
    expect(resolveShortcut(key('0'))).toBe('reset');
  });

  it('Ctrl/Cmd+Z desfaz; Ctrl+Y e Ctrl+Shift+Z refazem', () => {
    expect(resolveShortcut(key('z', { ctrlKey: true }))).toBe('undo');
    expect(resolveShortcut(key('Z', { metaKey: true }))).toBe('undo');
    expect(resolveShortcut(key('y', { ctrlKey: true }))).toBe('redo');
    expect(resolveShortcut(key('z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
  });

  it('ignora outras teclas e combinações com Alt ou Ctrl', () => {
    expect(resolveShortcut(key('a'))).toBeNull();
    expect(resolveShortcut(key('ArrowUp', { altKey: true }))).toBeNull();
    expect(resolveShortcut(key('ArrowUp', { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key('c', { ctrlKey: true }))).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('reconhece campos de digitação', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
  });

  it('não confunde com botões, o documento ou null', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('attachShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function handlers(): ShortcutHandlers {
    return {
      increment: vi.fn(),
      decrement: vi.fn(),
      reset: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
    };
  }

  const press = (target: EventTarget, k: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };

  it('chama o tratador certo e cancela o comportamento padrão', () => {
    const h = handlers();
    const detach = attachShortcuts(document, h);

    const event = press(document.body, 'ArrowUp');
    expect(h.increment).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);

    press(document.body, 'z', { ctrlKey: true });
    expect(h.undo).toHaveBeenCalledTimes(1);
    detach();
  });

  it('não interfere em campos de digitação', () => {
    const h = handlers();
    const detach = attachShortcuts(document, h);
    const input = document.createElement('input');
    document.body.append(input);

    const event = press(input, '0');
    expect(h.reset).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    detach();
  });

  it('deixa passar teclas desconhecidas sem cancelar', () => {
    const h = handlers();
    const detach = attachShortcuts(document, h);
    expect(press(document.body, 'Tab').defaultPrevented).toBe(false);
    detach();
  });

  it('detach remove o ouvinte', () => {
    const h = handlers();
    const detach = attachShortcuts(document, h);
    detach();
    press(document.body, 'ArrowUp');
    expect(h.increment).not.toHaveBeenCalled();
  });
});
