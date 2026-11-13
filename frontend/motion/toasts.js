// Notificações coordenadas (Plano 5.0 §6.4): entrada/saída suaves,
// reorganização por FLIP, limite de taxa e sem rajadas repetidas.

const LEVELS = new Set(['info', 'success', 'warning', 'error']);

export function createToasts(umx, container, { max = 3, duration = 4200, dedupeMs = 3000 } = {}) {
  const recent = new Map();
  const items = new Set();

  function reflow(mutate) {
    const first = new Map();
    for (const el of items) first.set(el, umx.measure(el));
    mutate();
    for (const [el, rect] of first) if (el.isConnected) umx.flip(el, rect, { spring: 'gentle' });
  }

  function dismiss(el) {
    if (!items.has(el)) return;
    items.delete(el);
    clearTimeout(el._umxTimer);
    el.setAttribute('data-leaving', '');
    umx.animate(el, { opacity: 0, x: 24 }, { spring: 'critical' }).finished.then(() => {
      reflow(() => el.remove());
    });
  }

  function show({ level = 'info', title, body = '', simulated = false } = {}) {
    if (!container || !title) return null;
    const lvl = LEVELS.has(level) ? level : 'info';
    const key = `${lvl}|${title}|${body}`;
    const now = performance.now();
    if (now - (recent.get(key) ?? -Infinity) < dedupeMs) return null;
    recent.set(key, now);

    const el = document.createElement('div');
    el.className = `umx-toast umx-toast--${lvl}`;
    el.setAttribute('role', lvl === 'error' ? 'alert' : 'status');
    const strong = document.createElement('strong');
    strong.textContent = simulated ? `[Simulação] ${title}` : title;
    el.appendChild(strong);
    if (body) {
      const p = document.createElement('span');
      p.textContent = body;
      el.appendChild(p);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'umx-toast__close';
    close.setAttribute('aria-label', 'Dispensar');
    close.textContent = '×';
    close.addEventListener('click', () => dismiss(el));
    el.appendChild(close);

    reflow(() => container.prepend(el));
    items.add(el);
    umx.animate(el, { opacity: 1, y: 0, scale: 1 }, { spring: 'responsive', from: { opacity: 0, y: -12, scale: 0.97 } });
    el._umxTimer = setTimeout(() => dismiss(el), lvl === 'error' ? duration * 1.6 : duration);

    const overflow = items.size > max ? [...items].slice(0, items.size - max) : [];
    for (const old of overflow) dismiss(old);
    return el;
  }

  return { show, dismiss, clear: () => [...items].forEach(dismiss) };
}
