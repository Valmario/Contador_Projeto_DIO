# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versões no padrão [SemVer](https://semver.org/lang/pt-BR/).

## [2.0.0]

### Adicionado

- Desfazer e refazer (botões e `Ctrl+Z` / `Ctrl+Y`)
- Vários contadores, cada um com valor e histórico próprios
- Limites e passo configuráveis pela tela e pela URL (`?min=&max=&step=`)
- Segurar `+` ou `-` para repetir a ação, com aceleração
- Barra de posição no intervalo, com marca no zero
- Botão "Zerar" e atalhos de teclado
- Memória do estado no navegador, com migração do formato da versão 1
- PWA: instalável e com modo offline
- Tema claro e escuro automático e suporte a `prefers-reduced-motion`
- Testes: 105 unitários e de integração (Vitest) e 24 de ponta a ponta (Playwright + axe)
- CI (lint, formatação, tipos, testes, build, ponta a ponta e Lighthouse), publicação no GitHub Pages, release automática e Dependabot

### Alterado

- Projeto migrado para TypeScript (modo estrito) e Vite, com a lógica separada da interface
- Fonte Open Sans servida do próprio site, em vez do Google Fonts

### Corrigido

- O contador interno ultrapassava os limites: depois de 12 cliques em `+`, um clique em `-` mostrava 11 em vez de 9
- Os botões não eram desabilitados nos limites (desafio da aula), apenas deixavam de atualizar o número
- Texto com contraste insuficiente (4,31:1 no rodapé do tema claro e 3,9:1 na etiqueta do contador ativo)
- Deslocamento de layout ao carregar a página (CLS de 0,26 para 0)
- `lang` do documento era `en` com conteúdo em português

## [1.0.0]

- Contador simples com `addEventListener`, limites e texto vermelho em negativos (projeto da aula da DIO)
