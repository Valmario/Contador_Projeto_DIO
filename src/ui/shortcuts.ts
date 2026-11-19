export type ShortcutAction = 'increment' | 'decrement' | 'reset' | 'undo' | 'redo';

export type ShortcutHandlers = Record<ShortcutAction, () => void>;

/** Campos de digitação mantêm seus atalhos nativos (ex.: Ctrl+Z dentro de um input). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true
  );
}

/** Traduz um evento de teclado em uma ação do contador (ou `null`). */
export function resolveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): ShortcutAction | null {
  if (event.altKey) return null;

  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase();
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y') return 'redo';
    return null;
  }

  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return 'increment';
    case 'ArrowDown':
    case 'ArrowLeft':
      return 'decrement';
    case '0':
      return 'reset';
    default:
      return null;
  }
}

/** Liga os atalhos ao documento. Devolve a função que remove o ouvinte. */
export function attachShortcuts(doc: Document, handlers: ShortcutHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return;
    const action = resolveShortcut(event);
    if (!action) return;
    event.preventDefault();
    handlers[action]();
  };

  doc.addEventListener('keydown', onKeyDown);
  return () => doc.removeEventListener('keydown', onKeyDown);
}
