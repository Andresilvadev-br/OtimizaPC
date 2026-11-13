# ULTRA MOTION X no OtimizaPC 5.0

> **Este documento substitui o capítulo 6 ("Ultra Motion 2.0 — Living Interface Engine")
> do [Plano Mestre 5.0](OtimizaPC_5.0_Plano_Mestre.pdf).** Onde o PDF disser
> "Ultra Motion 2.0" / "Ultra Motion Core 2.0", leia **ULTRA MOTION X**.
> Todas as regras de produto do capítulo continuam valendo: sem React, Windows 10
> primeiro, um único MotionDirector, nenhuma mensagem de sucesso sem confirmação real,
> perfis Ultra (padrão) / Balanced / Performance e nada animando em segundo plano.

O motor vem do repositório [ULTRA-MOTION-X](https://github.com/Andresilvadev-br/ULTRA-MOTION-X)
e é empacotado localmente em `frontend/vendor/ultra-motion-x/` (sem CDN, sem dependências).

## 1. O que mudou em relação ao Ultra Motion 2.0

| Ultra Motion 2.0 (plano) | ULTRA MOTION X (implementado) |
| --- | --- |
| GSAP como motor principal de DOM | Núcleo próprio de física analítica + Web Animations no compositor. GSAP vira **adaptador opcional** (`createGsapAdapter`) com travas de propriedade. |
| Molas integradas por frame | Mola **analítica exata**: mesma trajetória em 60/120/144/165/240 Hz e interrupção sem salto em qualquer instante. |
| Animações na thread principal | Trajetórias "assadas" em keyframes executados pelo **compositor (GPU)**; seguem fluidas mesmo com a thread de UI ocupada. |
| Rive para o Chico | `CharacterStateMachine` + renderizador SVG procedural sobre a **arte original**; `RiveCharacterRenderer` pronto para quando os assets Rive forem licenciados. |
| PixiJS para efeitos | `EffectsLayer` (canvas acelerado) criada sob demanda e destruída ao terminar; aceita renderizador externo (ex.: PixiJS empacotado). |
| — | **Renderização adaptativa**: sob engasgo, reduz só custo decorativo dentro do perfil e *sugere* (nunca troca) outro perfil. |
| — | **Interações inteligentes**: previsão de intenção do ponteiro prepara camadas e captura geometria antes do clique. |
| — | **Integração nativa com IA**: o Chico IA pede *intenções* declarativas (JSON validado, com limite de taxa); "celebrar" exige evento confirmado pelo backend. |

## 2. Arquitetura (nomes do plano → módulos do X)

| Subsistema do §6.1 | Módulo |
| --- | --- |
| MotionScheduler | `core/scheduler.js` — um rAF só enquanto há trabalho; fases read/update/write; pausa por motivo (`hidden`, `minimized`) |
| SpringDynamics | `physics/spring.js`, `physics/inertia.js` — perfis `snappy`, `responsive`, `gentle`, `expressive`, `critical`, `page`, `capsule`, `wobble` |
| TransitionCoordinator | `transitions/coordinator.js` — troca a tela na hora e faz o morphing depois; navegar no meio parte do estado visual atual |
| SharedElementRegistry | `data-umx-shared="chave"` + `transitions.register()` |
| MotionDirector | `director/director.js` — coreografias declarativas; `announce` só é aceito depois de `await` (validado na definição) |
| ThemeMotionBridge | `theme/theme-bridge.js` — tokens `--umx-*` derivados da cor do usuário em OKLab, contraste WCAG garantido |
| ChicoStateAnimator | `character/*` + `frontend/motion/chico.js` — prioridades, debounce, tempo mínimo de exibição |
| MotionBudget | `budget/*` — perfis, orçamento decorativo, monitor de ritmo de frames, modo jogo |

Integração específica do OtimizaPC em `frontend/motion/`:

| Arquivo | Função |
| --- | --- |
| `index.js` | `bootOtimizaMotion()` — inicializa tudo, liga a ponte WebView2 e expõe `OtimizaMotion.request()` |
| `events.js` | Contrato de eventos Go ↔ JS (espelho de `backend/motionevents`) |
| `choreographies.js` | §6.6: salvar clipe, otimizar PC, diagnóstico, abrir/fechar jogo, Safe Restore, notificações |
| `chico.js` | Estados e gestos do Chico Alive |
| `island.js` | Dynamic Island V2: cápsula física única, split, crossfade, REC discreto |
| `intro.js` | Abertura do Chico (pulável por clique/tecla, limpa tudo ao pular) |
| `toasts.js` | Notificações coordenadas com FLIP, deduplicação e limite |
| `storage.js` | Perfil salvo local + espelhado no Go; migração 4.9.x → padrão Ultra |
| `legacy-shim.js` | `window.UltraMotion` para telas 4.x ainda não migradas |
| `otimizapc-motion.css` | Estilos de suporte (luz do cursor, toggles, progresso, ilha, abertura) |

## 3. Como usar nas telas

```html
<link rel="stylesheet" href="motion/otimizapc-motion.css">
<script type="module">
  import { bootOtimizaMotion } from './motion/index.js';
  const motion = await bootOtimizaMotion({
    chico: document.querySelector('#chico'),   // arte original com data-part
    island: document.querySelector('.umx-island'),
    renderIsland: (activity) => buildIslandContent(activity),
    intro: { overlay: document.querySelector('.umx-intro'), logo: document.querySelector('[data-umx-logo]') },
  });
  // Botão "Salvar clipe": feedback imediato + comando ao Go com id de correlação.
  saveButton.addEventListener('click', () => motion.request('clip.save'));
</script>
```

Atributos declarativos (sem JavaScript por componente; um listener delegado na raiz):

| Atributo | Efeito |
| --- | --- |
| `data-umx-press[="0.95"]` | Compressão no primeiro frame e retorno de mola (mouse, toque e teclado) |
| `data-umx-hover` | Realce leve de cartões |
| `data-umx-light` | Luz que segue o cursor (Ultra/Balanced) |
| `data-umx-toggle` + `data-umx-thumb` | Polegar segue `aria-checked` (estado real); `aria-busy="true"` = aguardando |
| `data-umx-error` | Sacudida curta de erro |
| `data-umx-screen`, `data-umx-shared`, `data-umx-enter` | Telas, elementos compartilhados e entrada leve |
| `data-umx-target="nome"` | Alvo lógico para coreografias e intenções da IA |

Partes do Chico (`data-part`): `root`, `breath`, `shell`, `head`, `ear`, `eye`, `pupil`, `feet`, `tail`.
O Motion Lab usa uma arte **provisória** do tatu-bola; substitua pelo SVG original mantendo esses atributos.

## 4. Contrato com o backend Go

`backend/motionevents` (Go) emite eventos `{channel:"umx", type, id, seq, ts, payload}` via
`PostWebMessageAsJson` ou `window.__umx.receive(json)`. As funções de confirmação
(`ClipValidated`, `GameActivated`, `GameRestored`, `RestoreVerified`, `OptimizeResult`)
**recusam** emitir sucesso sem a evidência verificada e `OptimizeResult` envia parciais como
"N de M". Comandos da interface chegam com `ParseCommand`.

Fluxo típico (otimizar): `optimize.requested` (UI, feedback imediato) → `optimize.started`
(Go: operação real começou) → `optimize.progress {done,total}` (etapas reais) →
`optimize.confirmed {verified,total}` após releitura, ou `optimize.failed`.

## 5. Perfis

| Perfil | Entrega |
| --- | --- |
| **Ultra** (padrão, inclusive na migração sem preferência salva) | Física completa, morphing, Chico com respiração/piscadas/olhar, partículas e luz |
| **Balanced** | Mesma linguagem; menos partículas, sem olhar seguindo o cursor, molas com menos balanço |
| **Performance** | Feedback imediato sem overshoot; nada decorativo |

Jogo ativo (`game.activated` → `game.restored`) zera a decoração em qualquer perfil.
Janela oculta/minimizada (`visibilitychange` ou `app.visibility`) pausa o scheduler.

## 6. Motion Lab e testes

* `frontend/motion-lab/index.html` — pré-visualização com **eventos simulados** (rotulados
  "[Simulação]"; nada é aplicado ao Windows). `?qa=1` mostra métricas internas
  (frame p50/p95/p99, entrada→frame, Hz estimado) — ferramenta de QA, não painel do usuário.
* Motor: `npm test` no repositório ULTRA-MOTION-X (física, scheduler, animador, Director,
  Chico, tema, perfis, IA, ponte).
* Go: `cd backend/motionevents && go test -race ./...`
* Ponta a ponta (Chromium/Playwright): `node tests/e2e/motion-lab.e2e.mjs`
* Atualizar o motor empacotado: `scripts/sync-ultra-motion-x.sh ../ULTRA-MOTION-X`

## 7. Critérios de aceite (substituem o §6.18)

| Critério | Situação |
| --- | --- |
| Núcleo central reutilizado, sem React, HTML/CSS/JS sobre WebView2 | Implementado |
| MotionDirector único; anúncios só após confirmação do backend | Implementado e testado (definição recusa `announce` sem `await`) |
| Interrupção/inversão sem salto; navegação durante transição | Implementado e testado (unidade + e2e) |
| Transições compartilhadas entre telas | Implementado (miniatura → player, botão → galeria); faltam os pares das telas reais |
| Feedback imediato, resultado confirmado, erro distinto | Implementado |
| Chico reage a estados reais sem troca caótica | Implementado com arte provisória; **aplicar na arte original** |
| Tema/acento propagados pela UI | Implementado; overlay in-game ainda precisa carregar o CSS/motor |
| Abertura interrompível que não bloqueia o app | Implementado e testado |
| Perfis Ultra/Balanced/Performance persistidos | Implementado; persistência no AppData depende do handler `settings.set` no Go |
| Efeitos pausados ao minimizar/jogar | Implementado |
| Bibliotecas locais, sem CDN, fallback funcional | Implementado (motor sem dependências) |
| Evidências em Windows 10 22H2 / 11, monitores 60–240 Hz, iGPU antiga | **NÃO TESTADO** — exige o app real no Windows |
| Comparativo motor antigo × X (latência, frame pacing, consumo) | **NÃO TESTADO** — o código 4.x não está no repositório |

## 8. Pendências conhecidas

* O código-fonte do aplicativo (telas 4.9.x e backend Go) ainda não está versionado aqui; a
  integração está pronta como módulo, mas ligar cada tela real (atributos `data-umx-*`, chamadas
  `request()`, handler `settings.set` e emissões do `motionevents`) precisa ser feito no código do app.
* `legacy-shim.js` cobre as operações do motor 4.x descritas no Plano; os nomes exatos das
  funções antigas precisam ser conferidos quando o código 4.9.x for versionado.
* Arte do Chico: o SVG do Motion Lab é provisório.
