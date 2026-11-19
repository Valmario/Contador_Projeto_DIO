export interface CounterConfig {
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_CONFIG: Readonly<CounterConfig> = Object.freeze({
  min: -10,
  max: 10,
  step: 1,
});

/** Limite absoluto aceito para min/max: evita valores absurdos na tela e na URL. */
export const MAX_ABSOLUTE = 1_000_000;

/** Quantas ações ficam guardadas para desfazer. */
export const MAX_HISTORY = 100;

/**
 * Valida a configuração.
 * @throws {TypeError} se algum valor não for inteiro.
 * @throws {RangeError} se o intervalo ou o passo forem inválidos.
 */
export function assertValidConfig({ min, max, step }: CounterConfig): void {
  if (![min, max, step].every(Number.isInteger)) {
    throw new TypeError('Mínimo, máximo e passo devem ser números inteiros.');
  }
  if (Math.abs(min) > MAX_ABSOLUTE || Math.abs(max) > MAX_ABSOLUTE) {
    throw new RangeError(`Os limites devem ficar entre -${MAX_ABSOLUTE} e ${MAX_ABSOLUTE}.`);
  }
  if (min >= max) {
    throw new RangeError('O mínimo deve ser menor que o máximo.');
  }
  if (step <= 0) {
    throw new RangeError('O passo deve ser maior que zero.');
  }
  if (step > max - min) {
    throw new RangeError('O passo não pode ser maior que o intervalo entre mínimo e máximo.');
  }
}

/** Versão sem exceção de {@link assertValidConfig}: devolve a mensagem de erro ou `null`. */
export function getConfigError(config: CounterConfig): string | null {
  try {
    assertValidConfig(config);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Configuração inválida.';
  }
}

export interface CreateCounterOptions extends Partial<CounterConfig> {
  /** Valor inicial (ajustado ao intervalo). */
  initial?: number;
}

export interface Counter {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly atMin: boolean;
  readonly atMax: boolean;
  readonly isNegative: boolean;
  /** Posição do valor no intervalo, de 0 a 1. */
  readonly progress: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  /** Os métodos de ação devolvem `true` quando o valor realmente mudou. */
  increment(): boolean;
  decrement(): boolean;
  reset(): boolean;
  set(n: number): boolean;
  undo(): boolean;
  redo(): boolean;
  /** Troca limites e passo, reajusta o valor e limpa o histórico. */
  configure(config: Partial<CounterConfig>): void;
}

export function createCounter(options: CreateCounterOptions = {}): Counter {
  const { initial = 0, ...overrides } = options;
  let config: CounterConfig = { ...DEFAULT_CONFIG, ...overrides };
  assertValidConfig(config);
  if (!Number.isInteger(initial)) {
    throw new TypeError('O valor inicial deve ser um número inteiro.');
  }

  const clamp = (n: number): number => Math.min(config.max, Math.max(config.min, n));

  let value = clamp(initial);
  let past: number[] = [];
  let future: number[] = [];

  /** Aplica um novo valor registrando o histórico. Não faz nada se o valor não muda. */
  function moveTo(next: number): boolean {
    const target = clamp(next);
    if (target === value) return false;
    past.push(value);
    if (past.length > MAX_HISTORY) past.shift();
    future = [];
    value = target;
    return true;
  }

  return {
    get value() {
      return value;
    },
    get min() {
      return config.min;
    },
    get max() {
      return config.max;
    },
    get step() {
      return config.step;
    },
    get atMin() {
      return value <= config.min;
    },
    get atMax() {
      return value >= config.max;
    },
    get isNegative() {
      return value < 0;
    },
    get progress() {
      return (value - config.min) / (config.max - config.min);
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },

    increment: () => moveTo(value + config.step),
    decrement: () => moveTo(value - config.step),
    reset: () => moveTo(0),
    set(n) {
      if (!Number.isInteger(n)) {
        throw new TypeError('O valor deve ser um número inteiro.');
      }
      return moveTo(n);
    },
    undo() {
      const previous = past.pop();
      if (previous === undefined) return false;
      future.push(value);
      value = previous;
      return true;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return false;
      past.push(value);
      value = next;
      return true;
    },
    configure(partial) {
      const next = { ...config, ...partial };
      assertValidConfig(next);
      config = next;
      value = clamp(value);
      past = [];
      future = [];
    },
  };
}
