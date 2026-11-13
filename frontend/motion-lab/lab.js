// Motion Lab do OtimizaPC — pré-visualização com eventos SIMULADOS.
// Tudo aqui passa por umx.bridge.simulate(), que marca o evento como simulado:
// as mensagens exibidas recebem o prefixo [Simulação] e nada toca o Windows.

import { bootOtimizaMotion, EVENTS } from '../motion/index.js';
import { CHICO_STATES } from '../motion/chico.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const later = (ms, fn) => setTimeout(fn, ms);
const params = new URLSearchParams(location.search);

// A abertura usa uma cópia da arte do Chico.
const chicoEl = $('#chico');
const introChico = chicoEl.cloneNode(true);
introChico.removeAttribute('id');
introChico.removeAttribute('data-umx-target');
// ids do SVG precisam ser únicos (o gradiente da carapaça é referenciado por url(#id)).
for (const node of introChico.querySelectorAll('[id]')) {
  const old = node.id;
  node.id = `intro-${old}`;
  for (const ref of introChico.querySelectorAll(`[fill="url(#${old})"]`)) ref.setAttribute('fill', `url(#intro-${old})`);
}
$('#intro-chico-slot').appendChild(introChico);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function renderIsland(a) {
  switch (a.kind) {
    case 'music':
      return el('div', {}, el('span', { text: '♪' }), el('strong', { text: a.title ?? '' }), el('span', { class: 'muted', text: a.artist ?? '' }));
    case 'recording':
      return el('div', {}, el('span', { 'data-umx-rec': '' }), el('strong', { text: 'REC' }), el('span', { text: fmt(a.elapsed ?? 0) }), el('span', { class: 'muted', text: a.simulated ? 'simulação' : '' }));
    case 'timer':
      return el('div', {}, el('span', { text: '⏱' }), el('strong', { text: fmt(a.remaining ?? 0) }));
    default:
      return el('div', { text: a.kind });
  }
}

const motion = await bootOtimizaMotion({
  chico: chicoEl,
  island: $('#island'),
  islandBubble: $('#island-bubble'),
  renderIsland,
  intro: params.has('nointro') ? null : { overlay: $('#intro'), logo: $('.intro-logo'), chicoElement: introChico, short: params.has('short') },
});
const { umx, chico } = motion;
window.lab = motion;

let seq = 0;
const sim = (type, id, payload = {}) => umx.bridge.simulate({ type, id, seq: ++seq, payload });

// ---- Abertura ---------------------------------------------------------------
if (motion.intro) motion.intro.play();
$('#replay-intro').addEventListener('click', () => motion.intro?.play());

// ---- Chico: rótulo do estado real -----------------------------------------
chico.on('change', ({ state }) => { $('#chico-state').textContent = CHICO_STATES[state].label.toLowerCase(); });

// ---- Navegação com elementos compartilhados -------------------------------
const order = ['home', 'clips', 'lab'];
let current = 'home';
function go(name) {
  if (name === current) return;
  const dir = order.indexOf(name) > order.indexOf(current) ? 1 : -1;
  const from = $(`#screen-${current}`);
  const to = $(`#screen-${name}`);
  current = name;
  for (const b of $$('.nav-item')) {
    if (b.dataset.screen === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  umx.transitions.navigate({ from, to, direction: dir });
}
for (const b of $$('.nav-item')) b.addEventListener('click', () => go(b.dataset.screen));
$('#last-clip').addEventListener('click', () => go('clips'));

// ---- Otimizar / analisar ----------------------------------------------------
let n = 0;
function simulateOptimize(mode) {
  const id = `opt-${++n}`;
  sim(EVENTS.OPTIMIZE_REQUESTED, id);
  later(320, () => sim(EVENTS.OPTIMIZE_STARTED, id));
  const total = 5;
  for (let i = 1; i <= total; i++) {
    later(320 + i * 420, () => {
      if (mode === 'fail' && i === 3) sim(EVENTS.OPTIMIZE_FAILED, id, { message: 'O Windows recusou a alteração (UAC).' });
      else if (!(mode === 'fail' && i > 3)) sim(EVENTS.OPTIMIZE_PROGRESS, id, { done: i, total });
    });
  }
  if (mode !== 'fail') {
    later(320 + total * 420 + 280, () => sim(EVENTS.OPTIMIZE_CONFIRMED, id, { verified: mode === 'partial' ? 3 : total, total }));
  }
}
$('#btn-optimize').addEventListener('click', () => simulateOptimize('ok'));
$('#btn-optimize-fail').addEventListener('click', () => simulateOptimize('fail'));
$('#btn-optimize-partial').addEventListener('click', () => simulateOptimize('partial'));
$('#btn-scan').addEventListener('click', () => {
  const id = `scan-${++n}`;
  sim(EVENTS.SCAN_STARTED, id);
  later(1700, () => sim(EVENTS.SCAN_FINISHED, id, { findings: 3 }));
});

// ---- Modo Jogo -------------------------------------------------------------
$('#btn-game-open').addEventListener('click', () => {
  sim(EVENTS.GAME_DETECTED, 'game', { name: 'Jogo de exemplo' });
  later(900, () => sim(EVENTS.GAME_ACTIVATED, 'game', { name: 'Jogo de exemplo' }));
});
$('#btn-game-close').addEventListener('click', () => {
  sim(EVENTS.GAME_SESSION_ENDED, 'game');
  later(900, () => sim(EVENTS.GAME_RESTORED, 'game'));
});

// ---- Safe Restore ----------------------------------------------------------
for (const b of $$('[data-restore]')) {
  b.addEventListener('click', () => {
    const id = b.dataset.restore;
    sim(EVENTS.RESTORE_REQUESTED, id);
    later(800, () => (b.dataset.fail
      ? sim(EVENTS.RESTORE_FAILED, id, { message: 'O valor relido não corresponde ao original.' })
      : sim(EVENTS.RESTORE_VERIFIED, id)));
  });
}

// ---- Clipes ----------------------------------------------------------------
let clipCount = 0;
function simulateClip(fail) {
  const id = `clip-${++clipCount}`;
  sim(EVENTS.CLIP_SAVE_REQUESTED, id);
  later(900, () => (fail
    ? sim(EVENTS.CLIP_SAVE_FAILED, id, { message: 'Codec de vídeo indisponível.' })
    : sim(EVENTS.CLIP_SAVE_VALIDATED, id, { name: `Clipe ${clipCount} · 00:30` })));
}
$('#btn-clip').addEventListener('click', () => simulateClip(false));
$('#btn-clip-fail').addEventListener('click', () => simulateClip(true));

// Comportamento do "app": quando o backend valida o arquivo, a galeria ganha o item.
umx.director.on('event', (e) => {
  if (e.type === EVENTS.CLIP_SAVE_VALIDATED) {
    const item = el('button', { class: 'thumb', 'data-umx-press': '0.97', 'data-umx-clip': e.id ?? '' },
      el('span', { class: 'thumb-art' }), el('span', { class: 'thumb-label', text: e.payload.name ?? '' }));
    $('#gallery').prepend(item);
  }
  if (e.type === EVENTS.GAME_ACTIVATED) $('#game-name').textContent = e.payload.name ?? '—';
});

// ---- Perfil e cor ----------------------------------------------------------
const PROFILE_TEXT = {
  ultra: 'Física completa, morphing, Chico Alive, coreografias e luz controlada. (padrão)',
  balanced: 'Mesma linguagem visual com menos partículas e filtros.',
  performance: 'Resposta imediata, sem efeitos decorativos pesados.',
};
function syncProfile() {
  for (const b of $$('#profiles [data-profile]')) b.setAttribute('aria-checked', String(b.dataset.profile === umx.budget.profileId));
  $('#profile-desc').textContent = PROFILE_TEXT[umx.budget.profileId];
}
for (const b of $$('#profiles [data-profile]')) b.addEventListener('click', () => umx.budget.setProfile(b.dataset.profile));
umx.budget.on('profile', syncProfile);
syncProfile();

function syncAccent(hex) {
  for (const b of $$('#swatches [data-accent]')) b.setAttribute('aria-pressed', String(b.dataset.accent === hex));
  $('#accent-input').value = hex;
}
for (const b of $$('#swatches [data-accent]')) {
  b.addEventListener('click', () => { umx.theme.setAccent(b.dataset.accent); syncAccent(b.dataset.accent); });
}
$('#accent-input').addEventListener('input', (e) => { umx.theme.setAccent(e.target.value); syncAccent(e.target.value); });
syncAccent(umx.theme.accent);

// Tema claro: preferência local, aplicada na hora.
$('#toggle-light').addEventListener('click', (e) => {
  const t = e.currentTarget;
  const on = t.getAttribute('aria-checked') !== 'true';
  t.setAttribute('aria-checked', String(on));
  document.documentElement.dataset.theme = on ? 'light' : 'dark';
  umx.theme.setMode(on ? 'light' : 'dark', on ? '#ffffff' : '#141922');
});

// Alternância que depende do backend: pendente → confirmada.
$('#toggle-sound').addEventListener('click', (e) => {
  const t = e.currentTarget;
  if (t.getAttribute('aria-busy') === 'true') return;
  const next = t.getAttribute('aria-checked') !== 'true';
  t.setAttribute('aria-busy', 'true');
  later(450, () => {
    t.setAttribute('aria-checked', String(next));
    t.removeAttribute('aria-busy');
  });
});

// ---- Dynamic Island --------------------------------------------------------
let recTimer = null;
const islandActions = {
  music: () => sim(EVENTS.ISLAND_ACTIVITY, 'island-music', { kind: 'music', id: 'm', state: 'start', title: 'Faixa de exemplo', artist: 'Simulação' }),
  recording: () => {
    let elapsed = 0;
    sim(EVENTS.ISLAND_ACTIVITY, 'island-rec', { kind: 'recording', id: 'r', state: 'start', live: true, elapsed });
    clearInterval(recTimer);
    recTimer = setInterval(() => sim(EVENTS.ISLAND_ACTIVITY, 'island-rec', { kind: 'recording', id: 'r', state: 'update', live: true, elapsed: ++elapsed }), 1000);
  },
  timer: () => sim(EVENTS.ISLAND_ACTIVITY, 'island-timer', { kind: 'timer', id: 't', state: 'start', remaining: 300 }),
  end: () => {
    clearInterval(recTimer);
    for (const [kind, id] of [['music', 'm'], ['recording', 'r'], ['timer', 't']]) {
      sim(EVENTS.ISLAND_ACTIVITY, `island-${kind}`, { kind, id, state: 'end' });
    }
  },
};
for (const b of $$('[data-island]')) b.addEventListener('click', () => islandActions[b.dataset.island]());
// O conteúdo da gravação muda a cada segundo: a ilha re-renderiza só o necessário.
umx.director.on('event', (e) => {
  if (e.type !== EVENTS.ISLAND_ACTIVITY || e.payload.state !== 'update') return;
  const time = $('#island [data-umx-capsule-content]:not([data-umx-leaving]) span:nth-child(3)');
  if (time && e.payload.kind === 'recording') time.textContent = fmt(e.payload.elapsed);
});

// ---- Chico IA: intenções ---------------------------------------------------
umx.ai.onMessage = ({ message }) => motion.toasts.show({ level: 'info', title: 'Chico IA', body: message, simulated: true });
$('#ai-guide').addEventListener('click', () => {
  go('home');
  later(450, () => {
    const r = umx.ai.perform({ intent: 'guide', target: 'optimize.button', strength: 0.7, message: 'Comece por aqui: a otimização é verificada antes de ser anunciada.' });
    $('#ai-result').textContent = `guide → ${JSON.stringify(r)}`;
  });
});
$('#ai-celebrate').addEventListener('click', () => {
  const r = umx.ai.perform({ intent: 'celebrate', target: 'optimize.button', confirmedBy: { type: 'optimize.confirmed', id: 'nao-existe' } });
  $('#ai-result').textContent = `celebrate → ${JSON.stringify(r)}`;
});

// ---- Histórico -------------------------------------------------------------
const log = $('#log');
function addLog(text, cls) {
  const li = el('li', { class: cls ?? '', text: `${new Date().toLocaleTimeString()}  ${text}` });
  log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
}
umx.director.on('event', (e) => {
  if (e.type === EVENTS.ISLAND_ACTIVITY && e.payload.state === 'update') return;
  addLog(`evento ${e.type}${e.id ? ` #${e.id}` : ''}${e.simulated ? ' (simulado)' : ''}`, e.simulated ? 'sim' : '');
});
umx.director.on('end', ({ name, id, state }) => {
  if (name === 'island' || name === 'notify') return;
  addLog(`coreografia ${name}${id ? ` #${id}` : ''} → ${state}`, state === 'done' ? 'confirmed' : state === 'failed' ? 'error' : '');
});

// ---- QA interno ------------------------------------------------------------
if (params.get('qa') === '1') {
  $('#qa').hidden = false;
  const out = $('#qa-out');
  setInterval(() => {
    if (document.hidden || current !== 'lab') return;
    out.textContent = JSON.stringify({
      tela: { largura: screen.width, altura: screen.height, dpr: devicePixelRatio },
      ...umx.describe(),
    }, null, 2);
  }, 1000);
}
