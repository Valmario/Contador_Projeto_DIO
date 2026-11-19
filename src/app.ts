import { DEFAULT_CONFIG, getConfigError, type CounterConfig } from './core/counter';
import { configToQuery, parseIntStrict, resolveInitialConfig } from './core/config';
import { loadState, saveState } from './core/storage';
import { MAX_COUNTERS, createStore, type PersistedState, type Store } from './core/store';
import { attachHoldRepeat } from './ui/holdRepeat';
import { attachShortcuts } from './ui/shortcuts';

export interface AppDeps {
  /** `null` quando o navegador bloqueia o armazenamento. */
  storage: Storage | null;
  /** Query string atual da página (ex.: `?min=0&max=100`). */
  search: string;
  /** Atualiza a query string da URL sem recarregar a página. */
  replaceQuery: (query: string) => void;
}

export interface App {
  store: Store;
  destroy(): void;
}

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado no HTML.`);
  return element as T;
}

interface Chip {
  button: HTMLButtonElement;
  name: HTMLSpanElement;
  value: HTMLSpanElement;
}

/** Liga o HTML da página ao estado do contador. */
export function bootApp(doc: Document, deps: AppDeps): App {
  // ---------- Estado inicial: salvo -> URL ----------
  const saved = loadState(deps.storage);
  const config = resolveInitialConfig(saved?.config ?? null, deps.search);
  const initial: PersistedState = {
    v: 2,
    counters: [{ id: 'c1', name: 'Contador 1', value: 0 }],
    activeId: 'c1',
    ...saved,
    config,
  };
  const store = createStore(initial);

  // ---------- Elementos ----------
  const els = {
    chips: byId<HTMLDivElement>(doc, 'counters'),
    value: byId<HTMLOutputElement>(doc, 'value'),
    increment: byId<HTMLButtonElement>(doc, 'increment'),
    decrement: byId<HTMLButtonElement>(doc, 'decrement'),
    undo: byId<HTMLButtonElement>(doc, 'undo'),
    redo: byId<HTMLButtonElement>(doc, 'redo'),
    reset: byId<HTMLButtonElement>(doc, 'reset'),
    fill: byId<HTMLDivElement>(doc, 'track-fill'),
    zero: byId<HTMLDivElement>(doc, 'track-zero'),
    thumb: byId<HTMLDivElement>(doc, 'track-thumb'),
    limitMin: byId<HTMLSpanElement>(doc, 'limit-min'),
    limitMax: byId<HTMLSpanElement>(doc, 'limit-max'),
    message: byId<HTMLParagraphElement>(doc, 'message'),
    form: byId<HTMLFormElement>(doc, 'settings-form'),
    name: byId<HTMLInputElement>(doc, 'cfg-name'),
    min: byId<HTMLInputElement>(doc, 'cfg-min'),
    max: byId<HTMLInputElement>(doc, 'cfg-max'),
    step: byId<HTMLInputElement>(doc, 'cfg-step'),
    error: byId<HTMLParagraphElement>(doc, 'settings-error'),
    status: byId<HTMLParagraphElement>(doc, 'settings-status'),
    restore: byId<HTMLButtonElement>(doc, 'restore-defaults'),
    remove: byId<HTMLButtonElement>(doc, 'remove'),
  };

  const cleanups: (() => void)[] = [];

  // ---------- Contadores (chips) ----------
  const chips = new Map<string, Chip>();

  const addButton = doc.createElement('button');
  addButton.type = 'button';
  addButton.className = 'chip chip-add';
  addButton.textContent = '+';
  addButton.setAttribute('aria-label', 'Adicionar contador');

  function createChip(id: string): Chip {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.id = id;
    const name = doc.createElement('span');
    name.className = 'chip-name';
    const value = doc.createElement('span');
    value.className = 'chip-value';
    button.append(name, value);
    return { button, name, value };
  }

  /** Coloca o nó na posição certa só se preciso: mover um nó focado faria o foco se perder. */
  function placeAt(node: HTMLElement, index: number): void {
    const current = els.chips.children[index];
    if (current !== node) els.chips.insertBefore(node, current ?? null);
  }

  function renderChips(): void {
    const ids = new Set(store.entries.map((entry) => entry.id));
    for (const [id, chip] of chips) {
      if (!ids.has(id)) {
        chip.button.remove();
        chips.delete(id);
      }
    }

    store.entries.forEach((entry, index) => {
      let chip = chips.get(entry.id);
      if (!chip) {
        chip = createChip(entry.id);
        chips.set(entry.id, chip);
      }
      chip.name.textContent = entry.name;
      chip.value.textContent = String(entry.counter.value);
      chip.button.setAttribute('aria-pressed', String(entry.id === store.active.id));
      placeAt(chip.button, index);
    });

    addButton.disabled = store.entries.length >= MAX_COUNTERS;
    placeAt(addButton, store.entries.length);
  }

  els.chips.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button) return;
    if (button === addButton) {
      store.add();
      return;
    }
    if (button.dataset.id) store.select(button.dataset.id);
  });

  // ---------- Renderização ----------
  let lastActiveId = '';
  let lastValue = Number.NaN;

  function limitMessage(): string {
    const { counter } = store.active;
    if (counter.atMax) return `Limite máximo atingido (${counter.max}).`;
    if (counter.atMin) return `Limite mínimo atingido (${counter.min}).`;
    return '';
  }

  /** Um botão desabilitado perde o foco do teclado: leva o foco para um vizinho útil. */
  function rescueFocus(focused: Element | null): void {
    if (!(focused instanceof HTMLButtonElement) || !focused.disabled) return;
    const partner = new Map<Element, HTMLElement>([
      [els.increment, els.decrement],
      [els.decrement, els.increment],
      [els.undo, els.redo],
      [els.redo, els.undo],
      [els.remove, els.name],
    ]).get(focused);
    const target = [partner, els.reset, els.increment, els.decrement].find(
      (candidate) =>
        candidate !== undefined &&
        candidate !== focused &&
        !(candidate instanceof HTMLButtonElement && candidate.disabled),
    );
    target?.focus();
  }

  function bump(): void {
    els.value.classList.remove('bump');
    void els.value.offsetWidth; // força o navegador a reiniciar a animação
    els.value.classList.add('bump');
  }

  function render(): void {
    const { active } = store;
    const { counter } = active;
    const focused = doc.activeElement;

    els.value.textContent = String(counter.value);
    els.value.classList.toggle('negative', counter.isNegative);

    const percent = `${counter.progress * 100}%`;
    els.fill.style.width = percent;
    els.thumb.style.left = percent;
    const zeroPosition = (0 - counter.min) / (counter.max - counter.min);
    els.zero.hidden = zeroPosition < 0 || zeroPosition > 1;
    els.zero.style.left = `${zeroPosition * 100}%`;
    els.limitMin.textContent = String(counter.min);
    els.limitMax.textContent = String(counter.max);

    els.increment.setAttribute('aria-label', `Adicionar ${counter.step}`);
    els.decrement.setAttribute('aria-label', `Subtrair ${counter.step}`);
    els.increment.disabled = counter.atMax;
    els.decrement.disabled = counter.atMin;
    els.undo.disabled = !counter.canUndo;
    els.redo.disabled = !counter.canRedo;
    els.remove.disabled = store.entries.length <= 1;
    rescueFocus(focused);

    els.message.textContent = limitMessage();
    renderChips();

    const sameCounter = active.id === lastActiveId;
    if (!sameCounter) syncForm();
    else if (counter.value !== lastValue) bump();
    lastActiveId = active.id;
    lastValue = counter.value;
  }

  // ---------- Configurações ----------
  function setFormMessages(error: string, status: string): void {
    els.error.textContent = error;
    els.status.textContent = status;
  }

  function syncForm(): void {
    els.name.value = store.active.name;
    els.min.value = String(store.config.min);
    els.max.value = String(store.config.max);
    els.step.value = String(store.config.step);
    setFormMessages('', '');
  }

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next: CounterConfig = {
      min: parseIntStrict(els.min.value),
      max: parseIntStrict(els.max.value),
      step: parseIntStrict(els.step.value),
    };
    const error = getConfigError(next);
    if (error) {
      setFormMessages(error, '');
      return;
    }

    const changed = (Object.keys(next) as (keyof CounterConfig)[]).some(
      (key) => next[key] !== store.config[key],
    );
    store.rename(store.active.id, els.name.value);
    store.configure(next);
    els.name.value = store.active.name;
    setFormMessages(
      '',
      changed
        ? 'Configurações aplicadas. O histórico de desfazer foi limpo.'
        : 'Configurações aplicadas.',
    );
  });

  els.form.addEventListener('input', () => setFormMessages('', ''));

  els.restore.addEventListener('click', () => {
    store.configure({ ...DEFAULT_CONFIG });
    syncForm();
    setFormMessages('', 'Padrão restaurado.');
  });

  els.remove.addEventListener('click', () => {
    if (store.remove(store.active.id)) setFormMessages('', 'Contador removido.');
  });

  // ---------- Ações ----------
  els.undo.addEventListener('click', () => store.undo());
  els.redo.addEventListener('click', () => store.redo());
  els.reset.addEventListener('click', () => store.reset());
  cleanups.push(
    attachHoldRepeat(els.increment, () => store.increment()),
    attachHoldRepeat(els.decrement, () => store.decrement()),
    attachShortcuts(doc, {
      increment: () => store.increment(),
      decrement: () => store.decrement(),
      reset: () => store.reset(),
      undo: () => store.undo(),
      redo: () => store.redo(),
    }),
  );

  // ---------- Persistência e URL ----------
  let lastQuery: string | null = null;

  function sync(): void {
    saveState(deps.storage, store.snapshot());
    const query = configToQuery(store.config);
    if (query !== lastQuery) {
      lastQuery = query;
      deps.replaceQuery(query);
    }
  }

  cleanups.push(
    store.subscribe(() => {
      render();
      sync();
    }),
  );

  render();
  sync();

  return {
    store,
    destroy() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}
