import { describe, expect, it } from 'vitest';
import {
  configToQuery,
  parseConfigFromQuery,
  parseIntStrict,
  resolveInitialConfig,
} from '../../src/core/config';
import { DEFAULT_CONFIG } from '../../src/core/counter';

describe('parseIntStrict', () => {
  it('aceita inteiros, com espaços e sinal', () => {
    expect(parseIntStrict('42')).toBe(42);
    expect(parseIntStrict(' -7 ')).toBe(-7);
    expect(parseIntStrict('0')).toBe(0);
  });

  it('rejeita vazio, decimais, notação científica e lixo', () => {
    for (const text of ['', '  ', '1.5', '1e3', 'abc', '12abc', '--1', '+']) {
      expect(parseIntStrict(text)).toBeNaN();
    }
  });
});

describe('parseConfigFromQuery', () => {
  it('lê min, max e step', () => {
    expect(parseConfigFromQuery('?min=0&max=100&step=5')).toEqual({ min: 0, max: 100, step: 5 });
  });

  it('funciona sem o "?" e aceita negativos', () => {
    expect(parseConfigFromQuery('min=-50')).toEqual({ min: -50 });
  });

  it('ignora parâmetros ausentes, inválidos e desconhecidos', () => {
    expect(parseConfigFromQuery('?min=abc&max=&step=1.5&outro=9')).toEqual({});
    expect(parseConfigFromQuery('')).toEqual({});
  });
});

describe('configToQuery', () => {
  it('devolve vazio quando tudo é padrão', () => {
    expect(configToQuery({ ...DEFAULT_CONFIG })).toBe('');
  });

  it('inclui só o que difere do padrão', () => {
    expect(configToQuery({ min: 0, max: 10, step: 1 })).toBe('?min=0');
    expect(configToQuery({ min: 0, max: 100, step: 5 })).toBe('?min=0&max=100&step=5');
  });

  it('é o inverso de parseConfigFromQuery', () => {
    const config = { min: -5, max: 50, step: 5 };
    expect({ ...DEFAULT_CONFIG, ...parseConfigFromQuery(configToQuery(config)) }).toEqual(config);
  });
});

describe('resolveInitialConfig', () => {
  it('usa o padrão sem nada salvo e sem parâmetros', () => {
    expect(resolveInitialConfig(null, '')).toEqual(DEFAULT_CONFIG);
  });

  it('usa a configuração salva quando a URL não diz nada', () => {
    const saved = { min: 0, max: 20, step: 2 };
    expect(resolveInitialConfig(saved, '')).toEqual(saved);
  });

  it('a URL tem prioridade sobre o que estava salvo', () => {
    const saved = { min: 0, max: 20, step: 2 };
    expect(resolveInitialConfig(saved, '?max=30')).toEqual({ min: 0, max: 30, step: 2 });
  });

  it('descarta a URL inteira se o resultado for inválido', () => {
    const saved = { min: 0, max: 20, step: 2 };
    expect(resolveInitialConfig(saved, '?min=50')).toEqual(saved);
    expect(resolveInitialConfig(null, '?step=0')).toEqual(DEFAULT_CONFIG);
  });
});
