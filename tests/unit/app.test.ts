import { afterEach, describe, expect, it } from 'vitest';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, loadState, saveState } from '../../src/core/storage';
import { bootPage, cleanupPage, createMemoryStorage } from './helpers';

afterEach(() => {
  cleanupPage();
});

describe('contador na página', () => {
  it('começa em 0, com limites -10..10 e sem histórico', () => {
    const page = bootPage();
    expect(page.value()).toBe('0');
    expect(page.$('limit-min').textContent).toBe('-10');
    expect(page.$('limit-max').textContent).toBe('10');
    expect(page.$<HTMLButtonElement>('undo').disabled).toBe(true);
    expect(page.$<HTMLButtonElement>('redo').disabled).toBe(true);
    expect(page.$<HTMLButtonElement>('remove').disabled).toBe(true);
  });

  it('desafio 2: trava e desabilita o botão em cada limite, com aviso', () => {
    const page = bootPage();
    for (let i = 0; i < 12; i++) page.click('increment');
    expect(page.value()).toBe('10');
    expect(page.$<HTMLButtonElement>('increment').disabled).toBe(true);
    expect(page.$('message').textContent).toContain('máximo');
    expect(page.$('track-thumb').style.left).toBe('100%');

    page.click('decrement');
    expect(page.value()).toBe('9');
    expect(page.$<HTMLButtonElement>('increment').disabled).toBe(false);
    expect(page.$('message').textContent).toBe('');

    for (let i = 0; i < 25; i++) page.click('decrement');
    expect(page.value()).toBe('-10');
    expect(page.$<HTMLButtonElement>('decrement').disabled).toBe(true);
    expect(page.$('message').textContent).toContain('mínimo');
  });

  it('desafio 3: o número fica vermelho só quando é negativo', () => {
    const page = bootPage();
    page.click('decrement');
    expect(page.$('value').classList.contains('negative')).toBe(true);
    page.click('increment');
    expect(page.$('value').classList.contains('negative')).toBe(false);
  });

  it('zerar leva a 0 e coloca a barra no meio', () => {
    const page = bootPage();
    page.click('increment');
    page.click('increment');
    page.click('reset');
    expect(page.value()).toBe('0');
    expect(page.$('track-thumb').style.left).toBe('50%');
  });

  it('desfazer e refazer pelos botões e habilitam/desabilitam conforme o histórico', () => {
    const page = bootPage();
    page.click('increment');
    page.click('increment');
    expect(page.$<HTMLButtonElement>('undo').disabled).toBe(false);

    page.click('undo');
    expect(page.value()).toBe('1');
    expect(page.$<HTMLButtonElement>('redo').disabled).toBe(false);

    page.click('redo');
    expect(page.value()).toBe('2');
    expect(page.$<HTMLButtonElement>('redo').disabled).toBe(true);
  });

  it('a marca do zero só aparece se o zero estiver dentro do intervalo', () => {
    const inside = bootPage({ search: '?min=-10&max=30' });
    expect(inside.$('track-zero').hidden).toBe(false);
    expect(inside.$('track-zero').style.left).toBe('25%');

    const outside = bootPage({ search: '?min=5&max=50' });
    expect(outside.$('track-zero').hidden).toBe(true);
  });
});

describe('teclado', () => {
  it('setas, 0 e Ctrl+Z/Ctrl+Y', () => {
    const page = bootPage();
    page.key('ArrowUp');
    page.key('ArrowRight');
    page.key('ArrowRight');
    expect(page.value()).toBe('3');
    page.key('ArrowDown');
    page.key('ArrowLeft');
    expect(page.value()).toBe('1');

    page.key('z', { ctrlKey: true });
    expect(page.value()).toBe('2');
    page.key('y', { ctrlKey: true });
    expect(page.value()).toBe('1');

    page.key('0');
    expect(page.value()).toBe('0');
  });

  it('digitar nos campos de configuração não aciona os atalhos', () => {
    const page = bootPage();
    page.key('0', {}, page.$('cfg-min'));
    page.key('ArrowUp', {}, page.$('cfg-name'));
    expect(page.value()).toBe('0');
    expect(page.$<HTMLButtonElement>('undo').disabled).toBe(true);
  });
});

describe('foco do teclado', () => {
  it('passa para o botão oposto quando o focado é desabilitado no limite', () => {
    const page = bootPage();
    const increment = page.$<HTMLButtonElement>('increment');
    increment.focus();
    for (let i = 0; i < 10; i++) increment.click();
    expect(increment.disabled).toBe(true);
    expect(document.activeElement).toBe(page.$('decrement'));
  });

  it('desfazer: sem histórico, o foco vai para o "refazer" (ou para outro botão útil)', () => {
    const page = bootPage();
    page.click('increment');
    const undo = page.$<HTMLButtonElement>('undo');
    undo.focus();
    undo.click();
    expect(undo.disabled).toBe(true);
    expect(document.activeElement).toBe(page.$('redo'));
  });
});

describe('vários contadores', () => {
  it('adiciona, alterna e mantém o valor de cada um', () => {
    const page = bootPage();
    page.click('increment');
    page.click('increment');

    page.$('counters').querySelector<HTMLButtonElement>('.chip-add')?.click();
    expect(page.chips()).toHaveLength(2);
    expect(page.value()).toBe('0');

    page.click('increment');
    expect(page.value()).toBe('1');

    page.chips()[0]?.click();
    expect(page.value()).toBe('2');
    expect(page.chips().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(page.chips()[1]?.querySelector('.chip-value')?.textContent).toBe('1');
  });

  it('o botão "+" fica desabilitado no limite de contadores', () => {
    const page = bootPage();
    const add = page.$('counters').querySelector<HTMLButtonElement>('.chip-add');
    for (let i = 0; i < 10; i++) add?.click();
    expect(page.chips()).toHaveLength(8);
    expect(add?.disabled).toBe(true);
  });

  it('remove o contador ativo', () => {
    const page = bootPage();
    page.$('counters').querySelector<HTMLButtonElement>('.chip-add')?.click();
    expect(page.$<HTMLButtonElement>('remove').disabled).toBe(false);
    page.click('remove');
    expect(page.chips()).toHaveLength(1);
    expect(page.$<HTMLButtonElement>('remove').disabled).toBe(true);
  });

  it('trocar de contador atualiza o formulário com o nome dele', () => {
    const page = bootPage();
    page.$('counters').querySelector<HTMLButtonElement>('.chip-add')?.click();
    expect(page.$<HTMLInputElement>('cfg-name').value).toBe('Contador 2');
    page.chips()[0]?.click();
    expect(page.$<HTMLInputElement>('cfg-name').value).toBe('Contador 1');
  });
});

describe('configurações', () => {
  it('aplica limites e passo, renomeia e limpa o histórico', () => {
    const page = bootPage();
    page.click('increment');
    page.submitSettings({ name: 'Placar', min: '0', max: '100', step: '5' });

    expect(page.$('limit-max').textContent).toBe('100');
    expect(page.chips()[0]?.textContent).toContain('Placar');
    expect(page.$('settings-error').textContent).toBe('');
    expect(page.$('settings-status').textContent).toContain('aplicadas');
    expect(page.$<HTMLButtonElement>('undo').disabled).toBe(true);

    // O valor atual (1) é mantido; só o passo muda.
    expect(page.value()).toBe('1');
    page.click('increment');
    expect(page.value()).toBe('6');
    expect(page.$('increment').getAttribute('aria-label')).toBe('Adicionar 5');
  });

  it('mostra o erro e não muda nada com valores inválidos', () => {
    const page = bootPage();
    page.click('increment');

    page.submitSettings({ min: '50', max: '10', step: '1' });
    expect(page.$('settings-error').textContent).toMatch(/mínimo/i);
    expect(page.$('limit-max').textContent).toBe('10');
    expect(page.value()).toBe('1');

    page.submitSettings({ min: '', max: '10', step: '1' });
    expect(page.$('settings-error').textContent).not.toBe('');
    page.submitSettings({ min: '0', max: '1.5', step: '1' });
    expect(page.$('settings-error').textContent).not.toBe('');
  });

  it('o erro some ao voltar a digitar', () => {
    const page = bootPage();
    page.submitSettings({ min: '50', max: '10', step: '1' });
    page.$('cfg-min').dispatchEvent(new Event('input', { bubbles: true }));
    expect(page.$('settings-error').textContent).toBe('');
  });

  it('restaura o padrão', () => {
    const page = bootPage({ search: '?min=0&max=100&step=5' });
    expect(page.$('limit-max').textContent).toBe('100');
    page.click('restore-defaults');
    expect(page.$('limit-min').textContent).toBe('-10');
    expect(page.$('limit-max').textContent).toBe('10');
    expect(page.$<HTMLInputElement>('cfg-step').value).toBe('1');
  });

  it('reajusta o valor atual ao estreitar o intervalo', () => {
    const page = bootPage();
    for (let i = 0; i < 8; i++) page.click('increment');
    page.submitSettings({ min: '0', max: '5', step: '1' });
    expect(page.value()).toBe('5');
  });
});

describe('URL e persistência', () => {
  it('lê min, max e step da URL', () => {
    const page = bootPage({ search: '?min=0&max=100&step=5' });
    expect(page.$('limit-min').textContent).toBe('0');
    expect(page.$('limit-max').textContent).toBe('100');
    page.click('increment');
    expect(page.value()).toBe('5');
  });

  it('ignora uma URL inválida e usa o padrão', () => {
    const page = bootPage({ search: '?min=50&max=10' });
    expect(page.$('limit-max').textContent).toBe('10');
  });

  it('atualiza a URL quando a configuração muda, sem repetir a mesma query', () => {
    const page = bootPage();
    expect(page.replaced).toEqual(['']);
    page.click('increment');
    expect(page.replaced).toEqual(['']);

    page.submitSettings({ min: '0', max: '100', step: '5' });
    expect(page.replaced.at(-1)).toBe('?min=0&max=100&step=5');
  });

  it('salva o estado e o restaura ao recarregar', () => {
    const storage = createMemoryStorage();
    const first = bootPage({ storage });
    first.click('increment');
    first.click('increment');
    first.$('counters').querySelector<HTMLButtonElement>('.chip-add')?.click();
    first.click('decrement');

    const second = bootPage({ storage });
    expect(second.chips().map((c) => c.querySelector('.chip-value')?.textContent)).toEqual([
      '2',
      '-1',
    ]);
    expect(second.value()).toBe('-1');
  });

  it('migra o valor salvo pela versão antiga', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, '7');
    const page = bootPage({ storage });
    expect(page.value()).toBe('7');
    expect(loadState(storage)?.counters[0]?.value).toBe(7);
  });

  it('a URL vence a configuração salva', () => {
    const storage = createMemoryStorage();
    saveState(storage, {
      v: 2,
      config: { min: 0, max: 20, step: 2 },
      counters: [{ id: 'c1', name: 'A', value: 4 }],
      activeId: 'c1',
    });
    const page = bootPage({ storage, search: '?max=50' });
    expect(page.$('limit-max').textContent).toBe('50');
    expect(page.$('limit-min').textContent).toBe('0');
    expect(page.value()).toBe('4');
  });

  it('ignora um estado salvo corrompido', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, config: { min: 9, max: 1, step: 1 } }));
    const page = bootPage({ storage });
    expect(page.value()).toBe('0');
  });

  it('funciona normalmente sem armazenamento disponível', () => {
    const page = bootPage({ storage: null });
    page.click('increment');
    expect(page.value()).toBe('1');
  });
});
