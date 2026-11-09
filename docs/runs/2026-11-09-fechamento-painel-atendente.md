# Run 2026-11-09 — Fechamento do painel do atendente e README

Spec: [`docs/specs/0001-fechamento-painel-atendente.md`](../specs/0001-fechamento-painel-atendente.md)

## Execução

- **Fluxo:** completo (nova UI e novos contratos HTTP), executado inline pelo orquestrador nos papéis
  planner → dev (backend/frontend) → tester → reviewer. Não houve subagentes separados para reduzir handoffs.
  Modelo: Opus (sem fallback).
- **Decisão — terminar antes de refatorar:** o baseline estava verde (lint, build e testes), e as lacunas eram
  funcionais. O principal ponto de limpeza (`admin/page.tsx` monolítico) foi resolvido pela própria entrega.
  Refatorações amplas ficaram como follow-up.
- **Decisão — 422 em `/ingestion-jobs`:** filtros inválidos usam o mesmo `InvalidKnowledgeContentError`/422
  do módulo de conhecimento, em vez de 400.
- **Decisão — painel continua client-side:** a sessão do atendente é um cookie `httpOnly` da API com
  `Path=/api/v1` e CSRF por token. Migrar para Server Actions exigiria um proxy de sessão no Next.js e está fora
  do escopo.

## Resultado dos testes

| Comando                    | Status                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run format:check`     | PASS (31 arquivos fora do padrão no baseline foram formatados)           |
| `npm run lint`             | PASS                                                                     |
| `npm run typecheck` (novo) | PASS (corrigido erro de baseline `import.meta` em `rag-evaluation.spec`) |
| `npm test`                 | PASS (41 testes; +3 novos)                                               |
| `npm run build`            | PASS                                                                     |
| `npm run test:integration` | PASS (9 testes, PostgreSQL/pgvector descartável)                         |
| Smoke da API compilada     | PASS: preflight CORS, login, artigo, reindex, PDF inválido 422, jobs     |

## Revisão — follow-ups (não bloqueantes)

1. `GET /tickets` e `PATCH /tickets/:id` ainda retornam `idempotencyKey`; criar um mapeamento de resposta
   explícito, como já faz o detalhe.
2. Testes de componente para o painel (`apps/web` só tem teste de configuração).
3. O E2E HTTP de artigo/PDF até a resposta citada do assistente continua pendente (precisa de um provedor fake
   injetável no processo da API).
4. Avaliar a migração do painel para Server Components/Server Actions com proxy de sessão (CLAUDE.md §2).
5. Itens das Fases 9–10: revisão de segurança independente, rate limit global, métricas, logs estruturados,
   adaptador de object storage e CI com gates de cobertura e avaliação RAG.
