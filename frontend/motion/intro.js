// Abertura do Chico — edição X (Plano 5.0 §6.8).
// Rastros de luz convergem → Chico chega enrolado, quica com impacto controlado,
// desenrola, acena → logo se desenha → a interface recebe o personagem.
// Qualquer clique ou tecla pula NA HORA e limpa todos os efeitos.

export function registerIntro(umx, { overlay, chicoElement, logo, short = false } = {}) {
  if (!overlay) return null;
  let finished = true;
  let resolveDone = () => {};
  let done = Promise.resolve(true);

  const parts = (name) => (chicoElement ? [...chicoElement.querySelectorAll(`[data-part="${name}"]`)] : []);
  const finalize = () => {
    if (finished) return;
    finished = true;
    umx.effects?.clear();
    if (chicoElement) umx.set(chicoElement, { opacity: 1, scale: 1, rotate: 0, y: 0, x: 0 });
    for (const el of parts('head').concat(parts('feet'))) umx.set(el, { scale: 1, opacity: 1, x: 0, y: 0 });
    if (logo) logo.style.setProperty('--umx-draw', '0');
    overlay.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    umx.animate(overlay, { opacity: 0 }, { spring: 'critical' }).finished.then(() => {
      overlay.hidden = true;
      resolveDone(true);
    });
  };
  const skip = () => umx.director.cancelChannel('intro', 'skipped');

  umx.director.define('intro', {
    channel: 'intro',
    onCancel: finalize,
    steps: [
      {
        run: (ctx) => {
          overlay.hidden = false;
          umx.set(overlay, { opacity: 1 });
          if (chicoElement) umx.set(chicoElement, { opacity: 0, scale: 0.42, rotate: -200, y: -120 });
          for (const el of parts('head').concat(parts('feet'))) umx.set(el, { scale: 0.4, opacity: 0 });
          if (logo) logo.style.setProperty('--umx-draw', '1');
          if (chicoElement && umx.effects && !short) {
            const r = chicoElement.getBoundingClientRect();
            umx.effects.converge({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }
          return ctx.wait(short ? 100 : 380);
        },
      },
      {
        // Chega enrolado e quica (o impacto acontece ~0,3 s depois).
        run: async (ctx) => {
          if (!chicoElement) return;
          ctx.animate(chicoElement, { opacity: 1, y: 0, rotate: 0, scale: 0.42 }, { spring: { response: 0.36, damping: 0.6 } });
          await ctx.wait(short ? 160 : 300);
          if (umx.effects) {
            const r = chicoElement.getBoundingClientRect();
            umx.effects.wave({ x: r.left + r.width / 2, y: r.bottom - 6, radius: 120 });
          }
          await ctx.wait(short ? 60 : 140);
        },
      },
      {
        // Desenrola e acena.
        run: async (ctx) => {
          if (!chicoElement) return;
          ctx.animate(chicoElement, { scale: 1 }, { spring: 'expressive' });
          for (const el of parts('head').concat(parts('feet'))) ctx.animate(el, { scale: 1, opacity: 1 }, { spring: 'expressive' });
          for (const ear of parts('ear')) ctx.animate(ear, { rotate: 0 }, { spring: 'wobble', velocity: { rotate: 320 } });
          await ctx.wait(short ? 120 : 340);
        },
      },
      {
        // Logo se desenha (stroke-dashoffset via --umx-draw, 1 → 0).
        run: async (ctx) => {
          if (logo) ctx.animate(logo, { '--umx-draw': 0 }, { spring: 'page', from: { '--umx-draw': 1 } });
          await ctx.wait(short ? 140 : 460);
        },
      },
      { run: () => { finalize(); } },
    ],
  });

  return {
    /** Toca (ou repete) a abertura; resolve quando a interface foi liberada. */
    play() {
      umx.director.cancelChannel('intro', 'replay');
      finished = false;
      done = new Promise((r) => { resolveDone = r; });
      overlay.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
      umx.director.play('intro');
      return done;
    },
    skip,
    get done() { return done; },
  };
}
