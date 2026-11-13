// Cinematic Motion Director do OtimizaPC (Plano 5.0 §6.6) sobre o ULTRA MOTION X.
// Cada coreografia separa: feedback imediato de interação → espera da
// confirmação REAL do backend Go → anúncio do resultado (sucesso, parcial ou erro).

import { EVENTS } from './events.js';

const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Espera alguns frames por um elemento que o app renderiza após o evento. */
function waitForElement(umx, find, frames = 4) {
  return new Promise((resolve) => {
    const tick = (left) => {
      const el = find();
      if (el || left <= 0) return resolve(el ?? null);
      umx.scheduler.after(() => tick(left - 1));
    };
    tick(frames);
  });
}

function setBusy(el, busy) {
  if (!el) return;
  if (busy) el.setAttribute('aria-busy', 'true');
  else el.removeAttribute('aria-busy');
}

function flagError(el) {
  if (!el) return;
  el.removeAttribute('data-umx-error');
  // Reaplica no próximo frame para que o MutationObserver sacuda de novo.
  requestAnimationFrame(() => {
    el.setAttribute('data-umx-error', '');
    setTimeout(() => el.removeAttribute('data-umx-error'), 1200);
  });
}

export function registerChoreographies(umx, { chico = null, chicoElement = null, toasts = null } = {}) {
  const d = umx.director;
  const t = (name) => umx.target(name);
  const say = (ctx, msg) => toasts?.show({ ...msg, simulated: ctx.simulated });
  const shellParts = () => (chicoElement ? [...chicoElement.querySelectorAll('[data-part="shell"]')] : []);
  // Desenrola a carapaça pelo caminho mais curto até uma volta inteira.
  const resetShell = () => {
    for (const shell of shellParts()) {
      const turns = Math.round(umx.animator.value(shell, 'rotate') / 360) * 360;
      umx.animate(shell, { rotate: turns }, { spring: 'gentle' }).finished.then((ok) => ok && umx.set(shell, { rotate: 0 }));
    }
  };

  // 1) Salvar clipe: comando → arquivo validado → botão responde → miniatura nasce → Chico reage.
  d.define('clip.save', {
    on: EVENTS.CLIP_SAVE_REQUESTED,
    channel: 'clips',
    concurrency: 'parallel',
    steps: [
      {
        wait: false,
        run: (ctx) => {
          const btn = t('clips.button');
          setBusy(btn, true);
          ctx.onDispose(() => setBusy(btn, false));
        },
      },
      { await: EVENTS.CLIP_SAVE_VALIDATED, fail: EVENTS.CLIP_SAVE_FAILED, timeout: 45000 },
      {
        announce: 'success',
        run: async (ctx) => {
          const btn = t('clips.button');
          setBusy(btn, false);
          const id = ctx.id ?? '';
          const item = await waitForElement(umx, () => document.querySelector(`[data-umx-clip="${CSS.escape(id)}"]`));
          if (!ctx.isCurrent()) return;
          if (item && btn) {
            umx.flip(item, umx.measure(btn), { spring: 'page', opacity: [0.2, 1] });
          } else {
            const gallery = t('clips.gallery');
            if (gallery) ctx.animate(gallery, { scale: 1 }, { spring: 'expressive', velocity: { scale: 0.6 } });
          }
          chico?.react('success', { hold: 900 });
          say(ctx, { level: 'success', title: 'Clipe salvo', body: ctx.confirmed.payload.name ?? '' });
        },
      },
    ],
    onError: [{
      announce: 'error',
      run: (ctx) => {
        const btn = t('clips.button');
        setBusy(btn, false);
        flagError(btn);
        chico?.react('error');
        say(ctx, ctx.reason === 'timeout'
          ? { level: 'warning', title: 'O gravador não confirmou o clipe', body: 'Verifique a galeria antes de tentar de novo.' }
          : { level: 'error', title: 'Não foi possível salvar o clipe', body: ctx.failure?.payload?.message ?? '' });
      },
    }],
  });

  // 2) Otimizar PC: usuário confirma → operação real começa → progresso real → backend confirma.
  const setProgress = (ctx, value) => {
    const bar = t('optimize.progress');
    const fill = bar?.querySelector('[data-umx-fill]');
    if (!bar || !fill) return;
    const p = Math.min(1, Math.max(0, value));
    bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    ctx.animate(fill, { scaleX: p }, { spring: 'gentle' });
    for (const shell of shellParts()) ctx.animate(shell, { rotate: p * 360 }, { spring: 'gentle' });
  };

  d.define('optimize', {
    on: EVENTS.OPTIMIZE_REQUESTED,
    channel: 'optimize',
    concurrency: 'drop',
    steps: [
      {
        wait: false,
        run: (ctx) => {
          const btn = t('optimize.button');
          setBusy(btn, true);
          ctx.onDispose(() => setBusy(btn, false));
          const bar = t('optimize.progress');
          if (bar) {
            bar.hidden = false;
            bar.removeAttribute('data-state');
            bar.setAttribute('aria-valuenow', '0');
            const fill = bar.querySelector('[data-umx-fill]');
            if (fill) umx.set(fill, { scaleX: 0 });
          }
        },
      },
      { await: EVENTS.OPTIMIZE_STARTED, fail: EVENTS.OPTIMIZE_FAILED, timeout: 20000 },
      {
        run: (ctx) => {
          chico?.begin(`optimize:${ctx.id}`, 'applying');
          ctx.onDispose(() => chico?.end(`optimize:${ctx.id}`));
        },
      },
      {
        await: EVENTS.OPTIMIZE_CONFIRMED,
        fail: EVENTS.OPTIMIZE_FAILED,
        progress: EVENTS.OPTIMIZE_PROGRESS,
        onProgress: (ctx, e) => {
          const { done = 0, total = 0 } = e.payload;
          if (total > 0) setProgress(ctx, done / total);
        },
        timeout: 10 * 60 * 1000,
      },
      {
        announce: 'success',
        run: (ctx) => {
          const btn = t('optimize.button');
          setBusy(btn, false);
          chico?.end(`optimize:${ctx.id}`);
          resetShell();
          const { verified = 0, total = 0 } = ctx.confirmed.payload;
          const partial = total > 0 && verified < total;
          const bar = t('optimize.progress');
          if (bar) bar.dataset.state = partial ? 'partial' : 'done';
          chico?.react(partial ? 'partial' : 'success');
          if (!partial && btn && umx.effects) {
            const c = center(btn);
            umx.effects.wave({ x: c.x, y: c.y });
            umx.effects.burst({ x: c.x, y: c.y, count: 22 });
          }
          say(ctx, partial
            ? { level: 'warning', title: `${verified} de ${total} ajustes verificados`, body: 'Veja no relatório o que não pôde ser confirmado.' }
            : { level: 'success', title: 'Otimização concluída', body: `${total} ajuste(s) aplicados e verificados no Windows.` });
        },
      },
    ],
    onError: [{
      announce: 'error',
      run: (ctx) => {
        const btn = t('optimize.button');
        setBusy(btn, false);
        chico?.end(`optimize:${ctx.id}`);
        resetShell();
        const bar = t('optimize.progress');
        if (bar) bar.dataset.state = 'error';
        flagError(btn);
        chico?.react('error');
        say(ctx, ctx.reason === 'timeout'
          ? { level: 'warning', title: 'Sem confirmação da otimização', body: 'Nenhum resultado foi considerado aplicado.' }
          : { level: 'error', title: 'A otimização falhou', body: ctx.failure?.payload?.message ?? 'Nada foi marcado como concluído.' });
      },
    }],
  });

  // 3) Diagnóstico: Chico analisa enquanto o backend analisa de verdade.
  d.define('scan', {
    on: EVENTS.SCAN_STARTED,
    channel: 'scan',
    steps: [
      {
        run: (ctx) => {
          chico?.begin(`scan:${ctx.id}`, 'analyzing');
          ctx.onDispose(() => chico?.end(`scan:${ctx.id}`));
        },
      },
      { await: EVENTS.SCAN_FINISHED, fail: EVENTS.SCAN_FAILED, timeout: 5 * 60 * 1000 },
      {
        announce: 'result',
        run: (ctx) => {
          chico?.end(`scan:${ctx.id}`);
          const findings = Number(ctx.confirmed.payload.findings ?? 0);
          if (findings > 0) {
            chico?.react('found');
            say(ctx, { level: 'info', title: `${findings} melhoria(s) encontrada(s)`, body: 'Revise antes de aplicar.' });
          }
        },
      },
    ],
    onError: [{ announce: 'error', run: (ctx) => { chico?.end(`scan:${ctx.id}`); chico?.react('error'); } }],
  });

  // 4) Abrir jogo: processo detectado → ajustes aplicados → estado confirmado → ativação curta.
  d.define('game.on', {
    on: EVENTS.GAME_DETECTED,
    channel: 'game',
    priority: 60,
    steps: [
      { await: EVENTS.GAME_ACTIVATED, fail: EVENTS.GAME_ACTIVATION_FAILED, timeout: 30000 },
      {
        announce: 'success',
        run: (ctx) => {
          const badge = t('game.badge');
          if (badge) {
            badge.hidden = false;
            badge.dataset.state = 'on';
            ctx.animate(badge, { opacity: 1, scale: 1, y: 0 }, { spring: 'snappy', from: { opacity: 0, scale: 0.8, y: -6 } });
          }
          chico?.begin('game', 'game');
          const name = ctx.confirmed.payload.name ?? ctx.event.payload.name ?? 'jogo';
          say(ctx, { level: 'success', title: 'Modo Jogo ativado', body: name });
        },
      },
    ],
    onError: [{
      announce: 'error',
      run: (ctx) => say(ctx, { level: 'warning', title: 'Modo Jogo não confirmou a ativação', body: ctx.failure?.payload?.message ?? 'Nenhum ajuste foi anunciado como aplicado.' }),
    }],
  });

  // 5) Fechar jogo: sessão termina → ajustes restaurados → backend confirma → desativação distinta.
  d.define('game.off', {
    on: EVENTS.GAME_SESSION_ENDED,
    channel: 'game',
    priority: 60,
    steps: [
      { await: EVENTS.GAME_RESTORED, fail: EVENTS.GAME_RESTORE_FAILED, timeout: 30000 },
      {
        announce: 'success',
        run: (ctx) => {
          const badge = t('game.badge');
          if (badge) {
            badge.dataset.state = 'off';
            ctx.animate(badge, { opacity: 0, scale: 0.85, y: 6 }, { spring: 'critical' }).finished.then((ok) => {
              if (ok && badge.dataset.state === 'off') badge.hidden = true;
            });
          }
          chico?.end('game');
          say(ctx, { level: 'info', title: 'Ajustes do Modo Jogo restaurados', body: 'Restauração confirmada pelo sistema.' });
        },
      },
    ],
    onError: [{
      announce: 'error',
      run: (ctx) => {
        chico?.react('error');
        const badge = t('game.badge');
        if (badge) badge.dataset.state = 'error';
        say(ctx, { level: 'error', title: 'Restauração não confirmada', body: 'Abra o Safe Restore para revisar os ajustes.' });
      },
    }],
  });

  // 6) Safe Restore: animação reversa só depois da verificação real do estado do Windows.
  d.define('restore.undo', {
    on: EVENTS.RESTORE_REQUESTED,
    channel: 'restore',
    concurrency: 'parallel',
    steps: [
      {
        wait: false,
        run: (ctx) => {
          const item = document.querySelector(`[data-umx-restore="${CSS.escape(ctx.id ?? '')}"]`);
          setBusy(item, true);
          ctx.onDispose(() => setBusy(item, false));
        },
      },
      { await: EVENTS.RESTORE_VERIFIED, fail: EVENTS.RESTORE_FAILED, timeout: 60000 },
      {
        announce: 'success',
        run: async (ctx) => {
          const item = document.querySelector(`[data-umx-restore="${CSS.escape(ctx.id ?? '')}"]`);
          setBusy(item, false);
          if (item) {
            item.dataset.state = 'restored';
            const icon = item.querySelector('[data-umx-icon]');
            if (icon) ctx.animate(icon, { rotate: 0 }, { spring: 'expressive', from: { rotate: 360 } });
            await ctx.animate(item, { x: 0 }, { spring: 'gentle', from: { x: -14 } }).finished;
          }
          say(ctx, { level: 'success', title: 'Alteração desfeita', body: 'Estado original verificado no Windows.' });
        },
      },
    ],
    onError: [{
      announce: 'error',
      run: (ctx) => {
        const item = document.querySelector(`[data-umx-restore="${CSS.escape(ctx.id ?? '')}"]`);
        setBusy(item, false);
        flagError(item);
        say(ctx, { level: 'error', title: 'Não foi possível confirmar a reversão', body: ctx.failure?.payload?.message ?? '' });
      },
    }],
  });

  // 7) Notificações vindas do backend (já são fatos; só coordenamos a exibição).
  d.define('notify', {
    on: EVENTS.NOTIFY,
    channel: 'toast',
    concurrency: 'parallel',
    steps: [{ run: (ctx) => { say(ctx, ctx.payload); } }],
  });
}
