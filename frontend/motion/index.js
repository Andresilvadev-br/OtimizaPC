// OtimizaPC × ULTRA MOTION X — ponto de entrada do movimento da interface.
//
//   <link rel="stylesheet" href="motion/otimizapc-motion.css">
//   <script type="module">
//     import { bootOtimizaMotion } from './motion/index.js';
//     const motion = await bootOtimizaMotion({ chico: document.querySelector('#chico') });
//   </script>
//
// Substitui o Ultra Motion 2.0 previsto no Plano 5.0 mantendo as mesmas regras:
// sem React, um único MotionDirector, eventos reais do Go, perfis Ultra
// (padrão) / Balanced / Performance, pausa com jogo ou janela minimizada.

import { createUltraMotionX } from '../vendor/ultra-motion-x/index.js';
import { createChico } from './chico.js';
import { registerChoreographies } from './choreographies.js';
import { createToasts } from './toasts.js';
import { createIsland } from './island.js';
import { registerIntro } from './intro.js';
import { installLegacyShim } from './legacy-shim.js';
import { createSettingsStorage, migrateLegacyProfile } from './storage.js';
import { COMMANDS, EVENTS } from './events.js';

export { EVENTS, COMMANDS };

function readAccent() {
  const css = getComputedStyle(document.documentElement);
  return css.getPropertyValue('--otimizapc-accent').trim() || css.getPropertyValue('--accent').trim() || '#2f8cff';
}

/**
 * Inicializa o movimento do OtimizaPC.
 * @param {object} o
 * @param {Element} [o.chico]        SVG/elemento do Chico (arte original com data-part)
 * @param {Element} [o.toasts]       contêiner de notificações
 * @param {Element} [o.island]       cápsula da Dynamic Island (+ o.islandBubble, o.renderIsland)
 * @param {object}  [o.intro]        { overlay, logo, short } — abertura do Chico
 * @param {string}  [o.accent]       cor de destaque escolhida pelo usuário
 * @param {'dark'|'light'} [o.mode]
 */
export async function bootOtimizaMotion(o = {}) {
  const bridgeless = !globalThis.chrome?.webview;
  const umx = createUltraMotionX({
    accent: o.accent ?? readAccent(),
    mode: o.mode ?? (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'),
    surface: o.surface,
    storage: o.storage ?? createSettingsStorage({ bridge: null }),
    bridge: o.bridge ?? true,
  });
  // A persistência espelha no Go assim que a ponte existe.
  if (!o.storage) umx.budget.storage = createSettingsStorage({ bridge: umx.bridge });
  migrateLegacyProfile(umx.budget.storage, umx.budget.key);
  await umx.ready;
  const markProfile = () => { document.documentElement.dataset.umxProfile = umx.budget.profileId; };
  markProfile();
  umx.budget.on('profile', markProfile);

  const chico = createChico(umx, o.chico ?? null);
  const toasts = createToasts(umx, o.toasts ?? umx.target('toasts'));
  registerChoreographies(umx, { chico, chicoElement: o.chico ?? null, toasts });
  const island = o.island ? createIsland(umx, o.island, { bubble: o.islandBubble, render: o.renderIsland }) : null;
  const intro = o.intro ? registerIntro(umx, { chicoElement: o.chico, ...o.intro }) : null;
  umx.bind(document);

  // Estados do sistema que afetam todo o movimento (independem de animações).
  umx.director.on('event', (e) => {
    switch (e.type) {
      case EVENTS.GAME_ACTIVATED: umx.budget.setGameActive(true); break;
      case EVENTS.GAME_RESTORED:
      case EVENTS.GAME_ACTIVATION_FAILED: umx.budget.setGameActive(false); break;
      case EVENTS.APP_VISIBILITY:
        if (e.payload.state === 'minimized') umx.scheduler.pause('minimized');
        else umx.scheduler.resume('minimized');
        break;
      case EVENTS.THEME_CHANGED:
        if (e.payload.mode) umx.theme.setMode(e.payload.mode);
        if (e.payload.accent) umx.theme.setAccent(e.payload.accent);
        break;
      default: break;
    }
  });
  // Jogo ativo: o budget zera decoração (partículas, laços do Chico, brilho);
  // o feedback de interação continua imediato se o usuário abrir o app.

  // Engasgos persistentes → apenas sugestão (a decisão é do usuário).
  umx.events.on('suggestion', ({ suggested }) => {
    toasts.show({
      level: 'info',
      title: 'A interface engasgou algumas vezes',
      body: `Se preferir, troque o perfil de movimento para ${suggested === 'balanced' ? 'Balanced' : 'Performance'} em Configurações › Motion Lab.`,
    });
  });

  /**
   * Pedido da interface: feedback imediato (sem esperar o Go) + comando ao backend.
   * O resultado só é anunciado quando o backend responder com o mesmo id.
   */
  let seq = 0;
  function request(kind, payload = {}) {
    const id = payload.id ?? `${kind}-${Date.now().toString(36)}-${++seq}`;
    const map = {
      'clip.save': [EVENTS.CLIP_SAVE_REQUESTED, COMMANDS.CLIP_SAVE],
      optimize: [EVENTS.OPTIMIZE_REQUESTED, COMMANDS.OPTIMIZE],
      restore: [EVENTS.RESTORE_REQUESTED, COMMANDS.RESTORE],
    };
    const entry = map[kind];
    if (!entry) throw new Error(`Pedido desconhecido: ${kind}`);
    umx.director.dispatch({ type: entry[0], id, payload });
    const sent = umx.bridge?.send(entry[1], payload, { id }) ?? false;
    return { id, sent };
  }

  const shim = installLegacyShim(umx, { chico });
  const api = { umx, chico, toasts, island, intro, request, shim, bridgeless };
  globalThis.OtimizaMotion = api;
  return api;
}
