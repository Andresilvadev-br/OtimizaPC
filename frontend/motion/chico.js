// Chico Alive (Plano 5.0 §6.5) sobre o ULTRA MOTION X.
// O tatu-bola original continua sendo a arte: aqui só definimos estados,
// prioridades e gestos. Partes esperadas no SVG (data-part):
//   root, breath, shell, head, ear, eye, pupil, feet, tail

import { gestures } from '../vendor/ultra-motion-x/index.js';

/**
 * Estados reais do Chico. "sustained" = atividade em andamento (begin/end);
 * os demais são reações breves a resultados JÁ confirmados pelo backend.
 */
export const CHICO_STATES = Object.freeze({
  idle: { priority: 0, label: 'Ocioso' },
  game: { priority: 30, label: 'Modo Jogo ativo' },
  analyzing: { priority: 50, label: 'Analisando' },
  found: { priority: 60, hold: 1100, label: 'Encontrou melhoria' },
  partial: { priority: 65, hold: 2200, label: 'Concluído em parte' },
  success: { priority: 70, hold: 1500, label: 'Concluído' },
  applying: { priority: 80, label: 'Aplicando' },
  error: { priority: 90, hold: 3200, label: 'Erro ou limitação' },
});

/** Abertura dos olhos por estado (escala vertical). */
export const CHICO_EYES = Object.freeze({
  idle: 1, game: 0.8, analyzing: 0.72, found: 1.12, partial: 0.9, success: 1, applying: 0.55, error: 0.85,
});

const neutral = (api) => Promise.all([
  api.animate('head', { rotate: 0, x: 0, y: 0, scale: 1 }, { spring: 'gentle' }),
  api.animate('feet', { y: 0, scale: 1, opacity: 1 }, { spring: 'gentle' }),
  api.animate('tail', { rotate: 0 }, { spring: 'gentle' }),
  api.animate('shell', { rotate: 0, scale: 1 }, { spring: 'gentle' }),
  gestures.settle(api),
]);

/** Gestos: movimentos curtos, com pausas naturais e nenhum laço infinito. */
export const CHICO_GESTURES = Object.freeze({
  idle: neutral,

  async analyzing(api) {
    await Promise.all([
      api.animate('head', { rotate: -9, y: -1 }, { spring: 'gentle' }),
      api.animate('feet', { y: 0, scale: 1, opacity: 1 }, { spring: 'gentle' }),
      gestures.tilt(api, { deg: -3 }),
    ]);
  },

  async found(api) {
    await api.animate('head', { rotate: 6, y: -2 }, { spring: 'expressive' });
    if (!api.alive) return;
    if (api.decor()) await gestures.hop(api, { height: 8 });
    if (!api.alive) return;
    // "Aponta" para a recomendação com o focinho.
    await api.animate('head', { x: 3, rotate: 10 }, { spring: 'expressive' });
  },

  async applying(api) {
    // Enrola-se: cabeça, patas e cauda recolhem. A rotação da carapaça
    // acompanha o progresso REAL (ver choreographies.js → chicoProgress).
    await Promise.all([
      api.animate('head', { x: -6, y: 4, scale: 0.55 }, { spring: 'responsive' }),
      api.animate('feet', { y: -4, scale: 0.4, opacity: 0 }, { spring: 'responsive' }),
      api.animate('tail', { rotate: -40 }, { spring: 'responsive' }),
      api.animate('root', { scale: 0.94, y: 2 }, { spring: 'responsive' }),
    ]);
  },

  async success(api) {
    await neutral(api);
    if (!api.alive) return;
    if (api.decor()) await gestures.hop(api, { height: 12 });
    if (!api.alive) return;
    await api.animate('ear', { rotate: 0 }, { spring: 'wobble', velocity: { rotate: 260 } });
  },

  async partial(api) {
    await neutral(api);
    if (!api.alive) return;
    await api.animate('head', { rotate: 5 }, { spring: 'gentle' });
  },

  async error(api) {
    await Promise.all([
      api.animate('head', { rotate: 12, y: 3 }, { spring: 'gentle' }),
      api.animate('root', { scale: 0.96, y: 1 }, { spring: 'gentle' }),
      api.animate('tail', { rotate: 8 }, { spring: 'gentle' }),
    ]);
  },

  async game(api) {
    await neutral(api);
  },
});

/** Liga o Chico ao motor. Devolve o CharacterStateMachine. */
export function createChico(umx, element) {
  if (!element) return null;
  return umx.character(element, {
    states: CHICO_STATES,
    initial: 'idle',
    gestures: CHICO_GESTURES,
    eyeOpen: CHICO_EYES,
  });
}
