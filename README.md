# OtimizaPC

Otimizador para Windows 10/11 com o mascote Chico IA (tatu-bola).
Arquitetura: backend Go + WebView2 + HTML/CSS/JavaScript (sem React).

## Documentação

- [Plano Mestre da versão 5.0](docs/OtimizaPC_5.0_Plano_Mestre.pdf) — especificação de produto e prompt de implementação
  (Chico Clips Studio, Safe Restore, Smart Startup, Chico Repair Center, Dynamic Island V2,
  Optimization Integrity Engine e instalador OtimizaPC Setup 5.0).
- [ULTRA MOTION X](docs/ULTRA_MOTION_X.md) — motor de movimento da 5.0. **Substitui o capítulo 6
  (Ultra Motion 2.0) do Plano Mestre.**

## Movimento da interface (ULTRA MOTION X)

| Caminho | Conteúdo |
| --- | --- |
| `frontend/vendor/ultra-motion-x/` | Motor empacotado localmente (sem CDN/dependências) — atualizar com `scripts/sync-ultra-motion-x.sh` |
| `frontend/motion/` | Integração do OtimizaPC: coreografias, Chico, Dynamic Island, abertura, notificações, perfis |
| `frontend/motion-lab/` | Motion Lab: pré-visualização com eventos simulados (`?qa=1` para métricas internas) |
| `backend/motionevents/` | Contrato de eventos Go → WebView2 com confirmações que exigem verificação |
| `tests/e2e/` | Teste ponta a ponta do Motion Lab (Playwright) |

```bash
cd backend/motionevents && go test -race ./...
```

```bash
node tests/e2e/motion-lab.e2e.mjs
```

## Situação do repositório

O código-fonte do aplicativo ainda não foi versionado aqui. Os executáveis das versões 3.1 a 4.9.2
estão publicados apenas nas [Releases](https://github.com/Andresilvadev-br/OtimizaPC/releases).
O módulo de movimento está pronto para ser ligado às telas quando o código for adicionado.
