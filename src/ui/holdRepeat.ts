export interface HoldRepeatOptions {
  /** Tempo segurando antes de começar a repetir (ms). */
  initialDelay?: number;
  /** Intervalo da primeira repetição (ms). */
  startInterval?: number;
  /** Intervalo mais rápido que a repetição pode alcançar (ms). */
  minInterval?: number;
  /** A cada repetição o intervalo é multiplicado por este fator (< 1 acelera). */
  acceleration?: number;
}

/**
 * Faz o botão repetir a ação enquanto está pressionado, acelerando aos poucos.
 *
 * - O mouse e o toque são tratados em `pointerdown`.
 * - O teclado (Enter/Espaço) dispara `click` com `detail === 0`, tratado à parte,
 *   para a ação nunca rodar duas vezes por clique.
 * - A repetição para sozinha quando a ação devolve `false` (ex.: chegou no limite).
 *
 * @param action Executa a ação e devolve `true` se algo mudou.
 * @returns Função que remove todos os ouvintes.
 */
export function attachHoldRepeat(
  button: HTMLButtonElement,
  action: () => boolean,
  options: HoldRepeatOptions = {},
): () => void {
  const {
    initialDelay = 400,
    startInterval = 160,
    minInterval = 40,
    acceleration = 0.85,
  } = options;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let interval = startInterval;

  const stop = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    interval = startInterval;
  };

  const tick = (): void => {
    if (!action()) {
      stop();
      return;
    }
    interval = Math.max(minInterval, interval * acceleration);
    timer = setTimeout(tick, interval);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || button.disabled) return;
    stop();
    if (action()) timer = setTimeout(tick, initialDelay);
  };

  const onClick = (event: MouseEvent): void => {
    if (event.detail === 0) action();
  };

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('click', onClick);
  for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'contextmenu'] as const) {
    button.addEventListener(type, stop);
  }
  window.addEventListener('blur', stop);

  return () => {
    stop();
    button.removeEventListener('pointerdown', onPointerDown);
    button.removeEventListener('click', onClick);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'contextmenu'] as const) {
      button.removeEventListener(type, stop);
    }
    window.removeEventListener('blur', stop);
  };
}
