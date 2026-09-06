# Agent Router

## Escolha rápida

| Situação                                            | Especialista principal |
| --------------------------------------------------- | ---------------------- |
| Escopo, arquitetura ou decisão difícil de reverter  | `architect`            |
| Regra de conversa, ticket, prioridade ou estado     | `support-domain`       |
| Endpoint, caso de uso, Prisma ou integração         | `nestjs-backend`       |
| Chatbot, painel, UX ou acessibilidade               | `nextjs-frontend`      |
| Retrieval, resposta, citação, prompt ou avaliação   | `ai-rag`               |
| PDF, chunking, embedding, job ou reindexação        | `ingestion-worker`     |
| Login, autorização, upload, PII ou prompt injection | `security`             |
| Cenário de teste, regressão ou aceite               | `qa`                   |
| Revisão antes de PR ou entrega                      | `reviewer`             |
| Plano, checklist, ADR ou consistência documental    | `documentation`        |

## Sequências recomendadas

### Nova funcionalidade de suporte

1. `support-domain`
2. `nestjs-backend` ou `nextjs-frontend`
3. `qa`
4. `reviewer`

### Mudança em RAG

1. `ai-rag`
2. `security` quando houver fonte, autorização ou prompt
3. `nestjs-backend` ou `ingestion-worker`
4. `qa`
5. `reviewer`

### Ingestão de conhecimento

1. `ingestion-worker`
2. `security`
3. `ai-rag`
4. `qa`
5. `reviewer`

### Mudança estrutural

1. `architect`
2. especialista do componente afetado
3. `documentation`
4. `qa`
5. `reviewer`

## Skills relacionadas

- Pergunta com RAG: `answer-support-question`.
- Artigo ou PDF para indexação: `ingest-support-knowledge`.
- Sugestão de resumo, categoria e prioridade: `triage-support-ticket`.
