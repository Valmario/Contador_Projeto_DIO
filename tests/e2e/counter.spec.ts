import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const value = (page: Page) => page.locator('#value');
const plus = (page: Page) => page.getByRole('button', { name: /^Adicionar \d+$/ });
const minus = (page: Page) => page.getByRole('button', { name: /^Subtrair \d+$/ });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(value(page)).toHaveText('0');
});

test.describe('contador', () => {
  test('soma, subtrai e zera', async ({ page }) => {
    await plus(page).click();
    await plus(page).click();
    await minus(page).click();
    await expect(value(page)).toHaveText('1');

    await page.getByRole('button', { name: 'Zerar' }).click();
    await expect(value(page)).toHaveText('0');
  });

  test('desafio 2: desabilita o botão em cada limite e avisa', async ({ page }) => {
    for (let i = 0; i < 10; i++) await plus(page).click();
    await expect(value(page)).toHaveText('10');
    await expect(plus(page)).toBeDisabled();
    await expect(page.getByText('Limite máximo atingido (10).')).toBeVisible();

    await minus(page).click();
    await expect(value(page)).toHaveText('9');
    await expect(plus(page)).toBeEnabled();

    await page.getByRole('button', { name: 'Zerar' }).click();
    for (let i = 0; i < 10; i++) await minus(page).click();
    await expect(value(page)).toHaveText('-10');
    await expect(minus(page)).toBeDisabled();
    await expect(page.getByText('Limite mínimo atingido (-10).')).toBeVisible();
  });

  test('desafio 3: número negativo fica vermelho', async ({ page }) => {
    // A cor tem transição de 0,2 s: `poll` espera ela terminar em vez de ler um valor intermediário.
    const color = () => value(page).evaluate((el) => getComputedStyle(el).color);
    const positive = await color();

    await minus(page).click();
    await expect(value(page)).toHaveClass(/negative/);
    await expect.poll(color).toBe('rgb(198, 40, 40)');

    await plus(page).click();
    await expect(value(page)).not.toHaveClass(/negative/);
    await expect.poll(color).toBe(positive);
  });

  test('desfazer e refazer', async ({ page }) => {
    const undo = page.getByRole('button', { name: 'Desfazer' });
    const redo = page.getByRole('button', { name: 'Refazer' });
    await expect(undo).toBeDisabled();

    await plus(page).click();
    await plus(page).click();
    await undo.click();
    await expect(value(page)).toHaveText('1');
    await expect(redo).toBeEnabled();

    await redo.click();
    await expect(value(page)).toHaveText('2');
    await expect(redo).toBeDisabled();
  });
});

test.describe('teclado', () => {
  test('setas, 0, Ctrl+Z e Ctrl+Y', async ({ page }) => {
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(value(page)).toHaveText('3');

    await page.keyboard.press('ArrowDown');
    await expect(value(page)).toHaveText('2');

    await page.keyboard.press('Control+z');
    await expect(value(page)).toHaveText('3');
    await page.keyboard.press('Control+y');
    await expect(value(page)).toHaveText('2');

    await page.keyboard.press('0');
    await expect(value(page)).toHaveText('0');
  });

  test('Enter e Espaço em um botão executam a ação uma vez só', async ({ page }) => {
    await plus(page).focus();
    await page.keyboard.press('Enter');
    await expect(value(page)).toHaveText('1');
    await page.keyboard.press('Space');
    await expect(value(page)).toHaveText('2');
  });

  test('o foco passa para o botão oposto quando o focado é desabilitado', async ({ page }) => {
    await plus(page).focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('Enter');
    await expect(plus(page)).toBeDisabled();
    await expect(minus(page)).toBeFocused();
  });

  test('digitar nos campos de configuração não aciona os atalhos', async ({ page }) => {
    await page.getByText('Configurações').click();
    await page.getByLabel('Mínimo').focus();
    await page.keyboard.type('0');
    await page.keyboard.press('ArrowUp');
    await expect(value(page)).toHaveText('0');
  });
});

test.describe('segurar para repetir', () => {
  test('repete enquanto o botão está pressionado e para ao soltar', async ({ page }) => {
    await page.goto('/?min=0&max=1000');
    await expect(value(page)).toHaveText('0');

    const box = await plus(page).boundingBox();
    if (!box) throw new Error('botão sem posição');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();

    const held = Number(await value(page).textContent());
    expect(held).toBeGreaterThan(5);

    await page.waitForTimeout(500);
    await expect(value(page)).toHaveText(String(held));
  });

  test('um clique rápido soma só uma vez', async ({ page }) => {
    await plus(page).click();
    await page.waitForTimeout(700);
    await expect(value(page)).toHaveText('1');
  });
});

test.describe('configuração, vários contadores e persistência', () => {
  test('aplica limites e passo pela tela e reflete na URL', async ({ page }) => {
    await page.getByText('Configurações').click();
    await page.getByLabel('Nome do contador').fill('Placar');
    await page.getByLabel('Mínimo').fill('0');
    await page.getByLabel('Máximo').fill('100');
    await page.getByLabel('Passo').fill('5');
    await page.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page.getByText('Configurações aplicadas', { exact: false })).toBeVisible();
    await plus(page).click();
    await expect(value(page)).toHaveText('5');
    await expect(page).toHaveURL(/\?min=0&max=100&step=5$/);
    await expect(page.getByRole('button', { name: /Placar/ })).toBeVisible();
  });

  test('mostra o erro de configuração inválida', async ({ page }) => {
    await page.getByText('Configurações').click();
    await page.getByLabel('Mínimo').fill('50');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByRole('alert')).toContainText('mínimo');
    await expect(page.locator('#limit-max')).toHaveText('10');
  });

  test('lê a configuração da URL', async ({ page }) => {
    await page.goto('/?min=-5&max=50&step=5');
    await expect(page.locator('#limit-min')).toHaveText('-5');
    await expect(page.locator('#limit-max')).toHaveText('50');
    await plus(page).click();
    await expect(value(page)).toHaveText('5');
  });

  test('vários contadores mantêm valores independentes', async ({ page }) => {
    await plus(page).click();
    await plus(page).click();
    await page.getByRole('button', { name: 'Adicionar contador' }).click();
    await expect(value(page)).toHaveText('0');
    await minus(page).click();

    await page.getByRole('button', { name: /Contador 1/ }).click();
    await expect(value(page)).toHaveText('2');
    await page.getByRole('button', { name: /Contador 2/ }).click();
    await expect(value(page)).toHaveText('-1');
  });

  test('o estado sobrevive ao recarregar a página', async ({ page }) => {
    await plus(page).click();
    await plus(page).click();
    await plus(page).click();
    await page.getByRole('button', { name: 'Adicionar contador' }).click();
    await minus(page).click();

    await page.reload();
    await expect(value(page)).toHaveText('-1');
    await page.getByRole('button', { name: /Contador 1/ }).click();
    await expect(value(page)).toHaveText('3');
  });
});

test.describe('acessibilidade', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`sem violações do axe no tema ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.getByText('Configurações').click();
      await plus(page).click();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`sem violações do axe no limite, com aviso visível (tema ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.getByRole('button', { name: 'Adicionar contador' }).click();
      for (let i = 0; i < 10; i++) await plus(page).click();
      await expect(page.getByText('Limite máximo atingido (10).')).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('o contador é anunciado por leitores de tela', async ({ page }) => {
    await expect(value(page)).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#message')).toHaveAttribute('role', 'status');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });
});

test.describe('responsivo', () => {
  test('não rola na horizontal em tela de celular', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.getByText('Configurações').click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('os botões têm alvo de toque de pelo menos 44px', async ({ page }) => {
    for (const button of [plus(page), minus(page)]) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('PWA', () => {
  test('tem manifesto válido e ícones acessíveis', async ({ page, request }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(manifestHref ?? '', page.url()).href;
    const response = await request.get(manifestUrl);
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as { icons: { src: string }[]; display: string };
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(new URL(icon.src, manifestUrl).href);
      expect(iconResponse.ok(), icon.src).toBe(true);
    }
  });

  test('funciona offline depois da primeira visita (inclusive com parâmetros na URL)', async ({
    page,
    context,
  }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Espera o service worker guardar o JavaScript da página no cache.
    const scriptUrl = await page.locator('script[type="module"]').getAttribute('src');
    const absolute = new URL(scriptUrl ?? '', page.url()).href;
    await expect
      .poll(() => page.evaluate(async (url) => (await caches.match(url)) !== undefined, absolute))
      .toBe(true);

    await context.setOffline(true);
    await page.goto('/?min=0&max=100&step=5');

    await expect(page.getByRole('heading', { name: 'Contador' })).toBeVisible();
    await plus(page).click();
    await expect(value(page)).toHaveText('5');
    await context.setOffline(false);
  });
});
