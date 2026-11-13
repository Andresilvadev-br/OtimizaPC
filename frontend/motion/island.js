// Dynamic Island V2 — IslandMotionController sobre o CapsuleMorph do ULTRA MOTION X.
// Uma única "timeline" física para a cápsula: crescer/recolher/split sem saltos,
// conteúdo trocado por crossfade e estados vindos do backend (island.activity).

import { EVENTS } from './events.js';

const SIZES = Object.freeze({
  compact: { width: 188, height: 38 },
  transient: { width: 300, height: 58 },
  expanded: { width: 372, height: 92, radius: 26 },
});

const PRIORITY = { recording: 3, timer: 2, music: 1 };

/**
 * createIsland(umx, el, { bubble, render })
 *  - render(activity) → Element com o conteúdo da atividade (o app decide o HTML).
 *  - Atividades: { kind: 'music'|'recording'|'timer'|..., id, state: 'start'|'update'|'end', ... }
 */
export function createIsland(umx, el, { bubble = null, render } = {}) {
  if (!el) return null;
  const capsule = umx.capsule(el, { bubble, ...SIZES.compact });
  const activities = new Map();
  let mode = 'compact';
  let shown = null;
  let collapseTimer = null;

  const primary = () => [...activities.values()].sort((a, b) => (PRIORITY[b.kind] ?? 0) - (PRIORITY[a.kind] ?? 0))[0] ?? null;

  function present() {
    const top = primary();
    const key = top ? `${top.kind}:${top.id}:${top.rev}` : 'empty';
    if (key !== shown) {
      shown = key;
      const content = top && render ? render(top, { mode }) : null;
      capsule.swap(content);
    }
    capsule.setSplit(activities.size > 1);
    const rec = top?.kind === 'recording' && top.live;
    capsule.setRecording(!!rec, el.querySelector('[data-umx-rec]'));
    el.dataset.activity = top?.kind ?? 'none';
  }

  function setMode(next, { hold } = {}) {
    clearTimeout(collapseTimer);
    mode = next;
    el.dataset.mode = next;
    capsule.morphTo(SIZES[next]);
    if (hold) collapseTimer = setTimeout(() => setMode('compact'), hold);
  }

  function handle(e) {
    const a = e.payload ?? {};
    if (!a.kind) return;
    const id = `${a.kind}:${a.id ?? 'default'}`;
    if (a.state === 'end') {
      activities.delete(id);
    } else {
      const prev = activities.get(id);
      activities.set(id, { ...prev, ...a, rev: (prev?.rev ?? 0) + (a.state === 'update' ? 0 : 1), simulated: e.simulated });
    }
    present();
    // Eventos novos ganham destaque breve; atualizações (cronômetro, faixa) não expandem.
    if (a.state === 'start' || a.highlight) setMode('transient', { hold: 2600 });
  }

  umx.director.define('island', {
    on: EVENTS.ISLAND_ACTIVITY,
    channel: 'island',
    concurrency: 'parallel',
    steps: [{ run: (ctx) => { handle(ctx.event); } }],
  });

  el.addEventListener('click', () => setMode(mode === 'expanded' ? 'compact' : 'expanded'));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMode('compact'); });

  return {
    capsule,
    get mode() { return mode; },
    get activities() { return [...activities.values()]; },
    expand: () => setMode('expanded'),
    collapse: () => setMode('compact'),
    destroy: () => { clearTimeout(collapseTimer); capsule.destroy(); },
  };
}
