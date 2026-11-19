import { DEFAULT_CONFIG, getConfigError, type CounterConfig } from './counter';

/** Converte texto em inteiro de forma estrita. Devolve `NaN` para vazio, decimal ou lixo. */
export function parseIntStrict(text: string): number {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Lê `?min=0&max=100&step=5` da URL. Parâmetros ausentes ou inválidos são ignorados. */
export function parseConfigFromQuery(search: string): Partial<CounterConfig> {
  const params = new URLSearchParams(search);
  const result: Partial<CounterConfig> = {};
  for (const key of ['min', 'max', 'step'] as const) {
    const raw = params.get(key);
    if (raw === null) continue;
    const parsed = parseIntStrict(raw);
    if (Number.isInteger(parsed)) result[key] = parsed;
  }
  return result;
}

/** Gera a query string só com o que difere do padrão (`''` se tudo é padrão). */
export function configToQuery(config: CounterConfig): string {
  const params = new URLSearchParams();
  for (const key of ['min', 'max', 'step'] as const) {
    if (config[key] !== DEFAULT_CONFIG[key]) params.set(key, String(config[key]));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Decide a configuração inicial: os parâmetros da URL têm prioridade sobre o que estava salvo,
 * mas só valem se o conjunto final for válido.
 */
export function resolveInitialConfig(saved: CounterConfig | null, search: string): CounterConfig {
  const base: CounterConfig = saved ?? { ...DEFAULT_CONFIG };
  const candidate: CounterConfig = { ...base, ...parseConfigFromQuery(search) };
  return getConfigError(candidate) === null ? candidate : base;
}
