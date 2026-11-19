/**
 * Gera as imagens do README (docs/*.png) e um GIF de demonstração (docs/demo.gif).
 *
 * Uso:
 *   npm run build
 *   npm run screenshots
 *
 * Em máquinas sem os navegadores do Playwright:
 *   CHROME_PATH=/usr/bin/google-chrome npm run screenshots
 *
 * O GIF usa o ffmpeg; se ele não estiver instalado, só as imagens são geradas.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

if (!existsSync('dist/index.html')) {
  console.error('Pasta dist/ não encontrada. Rode "npm run build" antes.');
  process.exit(1);
}

mkdirSync('docs', { recursive: true });

const server = await preview({ preview: { port: 4174, strictPort: true, open: false } });
const url = 'http://localhost:4174/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

async function newPage(options) {
  const context = await browser.newContext({ deviceScaleFactor: 2, locale: 'pt-BR', ...options });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector('#value');
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const plus = (page) => page.getByRole('button', { name: /^Adicionar \d+$/ });
const minus = (page) => page.getByRole('button', { name: /^Subtrair \d+$/ });

try {
  // ---------- Imagens estáticas ----------
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await newPage({
      viewport: { width: 520, height: 800 },
      colorScheme: scheme,
    });
    for (let i = 0; i < 3; i++) await plus(page).click();
    await page.screenshot({ path: `docs/screenshot-${scheme}.png` });
    await context.close();
  }

  {
    const { context, page } = await newPage({
      viewport: { width: 520, height: 800 },
      colorScheme: 'light',
    });
    for (let i = 0; i < 10; i++) await plus(page).click();
    await page.screenshot({ path: 'docs/screenshot-limit.png' });
    await context.close();
  }

  {
    const { context, page } = await newPage({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      isMobile: true,
      hasTouch: true,
    });
    await page.getByRole('button', { name: 'Adicionar contador' }).click();
    for (let i = 0; i < 4; i++) await minus(page).click();
    await page.getByText('Configurações').click();
    await page.screenshot({ path: 'docs/screenshot-mobile.png', fullPage: true });
    await context.close();
  }

  // ---------- GIF de demonstração ----------
  const frames = mkdtempSync(join(tmpdir(), 'contador-frames-'));
  const { context, page } = await newPage({
    viewport: { width: 480, height: 740 },
    colorScheme: 'light',
    deviceScaleFactor: 1,
  });

  let n = 0;
  const shot = async (repeat = 1) => {
    await page.waitForTimeout(260); // deixa a animação do número terminar
    for (let i = 0; i < repeat; i++) {
      await page.screenshot({ path: join(frames, `f${String(n++).padStart(3, '0')}.png`) });
    }
  };

  await shot(3);
  for (let i = 0; i < 10; i++) {
    await plus(page).click();
    await shot(i === 9 ? 5 : 1); // segura um instante no limite
  }
  await minus(page).click();
  await shot(2);
  await page.getByRole('button', { name: 'Zerar' }).click();
  await shot(2);
  for (let i = 0; i < 4; i++) {
    await minus(page).click();
    await shot(i === 3 ? 4 : 1);
  }
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await shot(2);
  await page.getByRole('button', { name: 'Adicionar contador' }).click();
  await shot(2);
  for (let i = 0; i < 3; i++) {
    await plus(page).click();
    await shot();
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await shot(8);
  await context.close();

  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        '6',
        '-i',
        join(frames, 'f%03d.png'),
        '-vf',
        'scale=360:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
        'docs/demo.gif',
      ],
      { stdio: 'inherit' },
    );
    console.log('GIF gerado: docs/demo.gif');
  } catch {
    console.warn('ffmpeg não encontrado: o GIF não foi gerado (as imagens estão em docs/).');
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }

  console.log('Imagens geradas em docs/.');
} finally {
  await browser.close();
  server.httpServer.close();
}
