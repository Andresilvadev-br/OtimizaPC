// Teste ponta a ponta do ULTRA MOTION X no Motion Lab (Chromium, mesmo motor do WebView2).
// Uso: node tests/e2e/motion-lab.e2e.mjs   (requer o pacote "playwright" instalado)
//
// Verifica as regras do Plano 5.0 na interface real:
//  • abertura pulável não bloqueia o app;
//  • sucesso só depois da confirmação, parcial vira "N de M", falha vira erro;
//  • elementos compartilhados entre telas; alternância segue o estado confirmado;
//  • perfil persistido; tema derivado da cor; nenhum erro de console.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('../../frontend/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path.startsWith('..')) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/motion-lab/index.html`;

const browser = await chromium.launch();
const errors = [];
let failed = false;
const step = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`); } catch (err) { failed = true; console.log(`FAIL ${name}\n     ${err.message}`); }
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const toasts = () => page.$$eval('.umx-toast strong', (n) => n.map((x) => x.textContent));

  await page.goto(base);

  await step('abertura é pulável por clique e libera a interface', async () => {
    await page.waitForSelector('#intro:not([hidden])');
    await page.mouse.click(640, 430);
    await page.waitForSelector('#intro', { state: 'hidden', timeout: 1500 });
  });

  await step('otimização: Chico acompanha e o sucesso só vem após a confirmação', async () => {
    await page.click('#btn-optimize');
    await page.waitForTimeout(900);
    assert.equal(await page.$eval('#chico', (e) => e.dataset.characterState), 'applying');
    assert.equal((await toasts()).length, 0, 'nenhuma mensagem antes da confirmação');
    await page.waitForFunction(() => document.querySelector('[data-umx-target="optimize.progress"]').dataset.state === 'done', null, { timeout: 5000 });
    assert.ok((await toasts()).some((t) => t.includes('Otimização concluída')));
    assert.ok((await toasts()).every((t) => t.startsWith('[Simulação]')), 'eventos simulados são rotulados');
  });

  await step('resultado parcial aparece como "N de M"', async () => {
    await page.waitForTimeout(1600);
    await page.click('#btn-optimize-partial');
    await page.waitForFunction(() => document.querySelector('[data-umx-target="optimize.progress"]').dataset.state === 'partial', null, { timeout: 5000 });
    assert.ok((await toasts()).some((t) => t.includes('3 de 5 ajustes verificados')));
  });

  await step('falha segue o caminho de erro', async () => {
    await page.waitForTimeout(1600);
    await page.click('#btn-optimize-fail');
    await page.waitForFunction(() => document.querySelector('[data-umx-target="optimize.progress"]').dataset.state === 'error', null, { timeout: 5000 });
    assert.ok((await toasts()).some((t) => t.includes('A otimização falhou')));
  });

  await step('elemento compartilhado: miniatura → player sem bloquear a navegação', async () => {
    await page.click('#last-clip');
    await page.waitForTimeout(60);
    const moving = await page.$eval('#screen-clips .player', (e) => e.style.translate || e.getAnimations().length > 0);
    assert.ok(moving, 'player em morphing');
    assert.equal(await page.$eval('#screen-clips', (e) => e.hidden), false, 'tela trocou imediatamente');
  });

  await step('clipe salvo: miniatura nasce na galeria após validação', async () => {
    await page.waitForTimeout(500);
    await page.click('#btn-clip');
    await page.waitForSelector('#gallery [data-umx-clip="clip-1"]', { timeout: 3000 });
  });

  await step('alternância: polegar só assenta após confirmação', async () => {
    await page.click('.nav-item[data-screen="lab"]');
    await page.waitForTimeout(400);
    await page.click('#toggle-sound');
    assert.equal(await page.$eval('#toggle-sound', (e) => e.getAttribute('aria-checked')), 'false');
    await page.waitForFunction(() => document.querySelector('#toggle-sound').getAttribute('aria-checked') === 'true');
  });

  await step('perfil e cor persistem/propagam', async () => {
    await page.click('[data-profile="performance"]');
    await page.click('[data-accent="#ff7a1a"]');
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => localStorage.getItem('otimizapc.umx.profile')), 'performance');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.umxProfile), 'performance');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--umx-accent').trim()), '#ff7a1a');
    await page.reload();
    await page.waitForFunction(() => window.lab?.umx);
    assert.equal(await page.evaluate(() => window.lab.umx.budget.profileId), 'performance');
  });

  await step('IA não consegue celebrar sem confirmação do backend', async () => {
    const r = await page.evaluate(() => window.lab.umx.ai.perform({ intent: 'celebrate', confirmedBy: { type: 'optimize.confirmed', id: 'x' } }));
    assert.equal(r.reason, 'not-confirmed-by-backend');
  });

  await step('nenhum erro de console', async () => assert.deepEqual(errors, []));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
