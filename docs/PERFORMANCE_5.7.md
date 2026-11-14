# Desempenho 5.7 — medições antes/depois

Ambiente: Chromium headless (Playwright), Linux, **renderização por CPU (sem GPU)**, janela 1360×860,
interface do app no modo demonstração. Mediana de 3 execuções por coluna; mesmo ambiente antes e depois.
Ferramenta: `app/tools/bench/ui-bench.cjs` (não versionada aqui junto com o código do app).
Navegação = 3 ciclos pelas 18 páginas (o último com troca rápida a cada 120 ms).

| Métrica | 5.6.0 Ultra | 5.7 Ultra | 5.6.0 Automático | 5.7 Automático* |
|---|---|---|---|---|
| Interface utilizável (ms) | 1432 | 1471 | 1395 | 1477 |
| CPU em repouso (ms/s) | 77.1 | 59.2 | 76.9 | 43.9 |
| Layouts em repouso (8 s) | 249 | 198 | 268 | 154 |
| Recálculos de estilo em repouso (8 s) | 492 | 322 | 487 | 311 |
| CPU navegando (ms/s) | 333 | 284.2 | 337 | 216.3 |
| Quadro p50 (ms) | 33.3 | 33.3 | 33.3 | 16.7 |
| Quadro p95 (ms) | 66.6 | 50 | 50.1 | 33.4 |
| Quadro p99 (ms) | 83.3 | 83.3 | 83.4 | 50 |
| Quadros perdidos (>1,5× 16,7 ms) | 416 | 404 | 419 | 108 |
| Tarefas longas (>50 ms) | 11 | 5 | 13 | 0 |
| Maior tarefa longa (ms) | 98 | 65 | 96 | 0 |
| Clique → quadro p50 (ms) | 54.9 | 48.3 | 56.5 | 30.7 |
| Clique → quadro p95 (ms) | 89.1 | 79.9 | 96.2 | 47.5 |
| Heap JS em repouso (MB) | 2.2 | 2.4 | 2.2 | 2.3 |
| Heap JS após 54 navegações (MB) | 3.1 | 3.2 | 3.1 | 3.2 |
| Nós DOM repouso → após navegação | 1901 → 1899 | 1893 → 1891 | 1900 → 1899 | 1871 → 1869 |
| Listeners após navegação | 140 | 142 | 140 | 142 |
| Intervalos (setInterval) ativos | 6 | 5 | 6 | 5 |

\* No Automático, a 5.7 detecta a renderização por software deste ambiente e escolhe **Efficiency**;
a 5.6.0 escolhia Ultra pela GPU informada. As colunas "Ultra" comparam a mesma qualidade visual.

## O que foi corrigido (causa medida → correção)

| Gargalo medido | Correção |
|---|---|
| Camada da página antiga clonava toda a árvore e escalava/deslocava a tela inteira por quadro (A/B: p50 33 → 17 ms sem ela) | blocos **movidos** (sem clone), materiais simplificados na camada e só esmaecimento; a profundidade continua na cascata dos blocos |
| Shimmer de placeholders animava `background-position` (repintura contínua; ~15 ms/s em repouso) | brilho em pseudo-elemento animado por `transform` (compositor) |
| Mini-gráficos de CPU/RAM interpolavam `d` do SVG por 0,9 s a cada 2 s (~10 ms/s e ~8 layouts/s em repouso) | interpolação de 0,35 s (mesma continuidade, ~1/3 do custo) |
| Borda de luz dos cartões com `mask-composite` e sombras de 60 px | `background-clip` (padding-box + border-box) e sombras menores, mesmo visual |
| Motor: "assar" uma mola para o compositor gerava 60–180 keyframes por grupo (1,6 ms/elemento em Ultra) | caminho rápido com 2 keyframes + `linear()` em cache quando a mola parte do repouso (**0,28 ms/elemento**, trajetória idêntica) |
| `Ambient.sync` acordava a cada 1,5 s | sincroniza por evento (página, visibilidade, preferências, jogo) |
| Sem perfil automático real (a escolha era só pelo nome da GPU) | `PerformanceGovernor` no motor: teto pelo hardware (núcleos, RAM, GPU, renderização por software) e ajuste pelo ritmo real de quadros com histerese; **Automático** é o padrão de quem nunca escolheu; Ultra/Balanced/Efficiency manuais continuam fixos |

## Estresse e vazamentos
400 cliques rápidos de navegação + redimensionamentos + rajadas de avisos: nenhuma camada fantasma
remanescente, listeners estáveis (130 → 130), nós DOM 2084 → 1568, heap 1,9 → 3,0 MB após GC
(5.6.0: 1,8 → 2,8 MB, mesmo comportamento). Sem erros de JavaScript.

## Avaliado e não alterado (medição não justificou)
- Montagem das páginas: todas ≤ 10 ms com ≤ 420 nós → virtualização de listas seria especulativa.
- Criar uma mola (`createTrack`): ~8 µs → efeitos que seguem o cursor custam < 0,1 ms/quadro.
- Inicialização: ~1,4 s até a interface utilizável nos dois; não mudou de forma mensurável.

## Limitações
- Sem GPU neste ambiente: tempos de quadro absolutos não representam um PC com placa de vídeo;
  só a comparação antes/depois é válida. Em Ultra o p50 continuou em ~33 ms aqui (pintura por CPU).
- **NÃO TESTADO** em Windows 10/11 real, WebView2, monitores 144–240 Hz, nem consumo do overlay com
  jogo aberto (o overlay e o backend Go não podem ser executados neste ambiente).
- Não é "zero-stutter": quadros acima do orçamento continuam existindo neste ambiente.
