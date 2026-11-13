// Camada de compatibilidade para a migração incremental (Plano 5.0 §6.0/§6.1).
//
// Telas da série 4.x que ainda chamam o motor antigo continuam funcionando:
// as chamadas são redirecionadas ao ULTRA MOTION X, de modo que um único
// motor controla cada propriedade. Os nomes abaixo cobrem as operações do
// motor 4.x descritas no Plano (mola, transição compartilhada, tema, Chico);
// confira-os com o código 4.9.x quando ele for versionado e remova esta camada
// quando a última tela tiver migrado.

export function installLegacyShim(umx, { chico = null, target = globalThis } = {}) {
  const warned = new Set();
  const note = (name) => {
    if (warned.has(name)) return;
    warned.add(name);
    console.info(`[OtimizaPC] UltraMotion.${name} (4.x) → ULTRA MOTION X. Migre esta chamada quando possível.`);
  };

  const shim = {
    version: `X ${umx.VERSION}`,
    engine: umx,
    spring(el, props, opts = {}) {
      note('spring');
      return umx.animate(el, props, { spring: opts.preset ?? opts.spring ?? 'responsive', ...opts }).finished;
    },
    animate(el, props, opts) { note('animate'); return umx.animate(el, props, opts).finished; },
    transition(fromScreen, toScreen, opts = {}) {
      note('transition');
      return umx.transitions.navigate({ from: fromScreen, to: toScreen, ...opts }).finished;
    },
    sharedTransition(fromEl, toEl, opts) { note('sharedTransition'); return umx.transitions.morph(fromEl, toEl, opts).finished; },
    setTheme(accent, mode) { note('setTheme'); if (mode) umx.theme.setMode(mode); umx.theme.setAccent(accent); },
    setProfile(id) { note('setProfile'); return umx.budget.setProfile(id); },
    chico(state) {
      note('chico');
      if (!chico) return false;
      // O 4.x mandava estados diretamente; no X, estados longos são atividades.
      if (['analyzing', 'applying', 'game'].includes(state)) {
        chico.begin(`legacy:${state}`, state);
      } else if (state === 'idle') {
        for (const a of chico.activities) {
          if (a.id.startsWith('legacy:')) chico.end(a.id);
        }
      } else {
        chico.react(state);
      }
      return true;
    },
  };
  target.UltraMotion = shim;
  return shim;
}
