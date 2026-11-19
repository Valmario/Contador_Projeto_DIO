import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos: o app funciona em qualquer subpasta (ex.: GitHub Pages em /Contador_Projeto_DIO/).
  base: './',
  build: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/pwa.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'html'],
    },
  },
});
