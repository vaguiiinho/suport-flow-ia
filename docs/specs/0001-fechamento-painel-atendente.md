# Spec 0001 — Fechamento do painel do atendente (Fase 7) e ambiente executável

## Problema

O MVP já cobre chat com RAG, criação confirmada de tickets e ingestão, mas o painel `/admin` só lista tickets
e fontes. Pendências identificadas na verificação do projeto:

1. o atendente não vê a conversa, as fontes citadas nem o histórico de mudanças de um ticket;
2. não há como criar artigos, enviar PDFs, ver falhas de ingestão ou solicitar reprocessamento pela interface;
3. `GET/PATCH /tickets/:id` e os filtros de listagem aceitam valores arbitrários, que chegam ao Prisma e viram `500`;
4. o serviço `api` do `docker-compose.yml` não recebe `OPENAI_API_KEY` nem as variáveis do assistente, então o chat
   sempre responde com fallback na pilha em containers;
5. `apps/worker/.env.example` não documenta as variáveis do provedor de embeddings;
6. não existe `npm run typecheck`, e não há README com instruções de execução.

## Comportamento esperado

### API

- `GET /tickets/:ticketId` (atendente) retorna o ticket acrescido de:
  - `messages`: mensagens da conversa em ordem cronológica (`role`, `content`, `createdAt`, `citations`), com as
    citações reduzidas a `sourceId`, `sourceVersion`, `title` e `page` — metadados de execução não são expostos;
  - `history`: eventos de auditoria (`type`, `changes`, `actorUserId`, `createdAt`), do mais antigo ao mais recente.
- `ticketId` precisa ser UUID; filtros `status`/`priority` inválidos retornam `400`.
- `GET /ingestion-jobs?status=FAILED&limit=50` (atendente) lista os jobs da organização com título, tipo,
  `familyId` e versão da fonte, mais recentes primeiro. `limit` entre 1 e 100 (padrão 50); `status`/`limit`
  inválidos retornam `422`, como o restante do módulo de conhecimento.
- Isolamento por organização é obrigatório em todas as consultas.

### Web (`/admin`)

- Tickets: filtro por estado/prioridade, alteração de estado/prioridade/categoria e painel de detalhe com
  conversa, fontes citadas e trilha de mudanças.
- Conhecimento: formulário de artigo (título, conteúdo, visibilidade), upload de PDF, lista de fontes com
  estado de indexação e botão "Reprocessar"; seção de falhas de ingestão com o erro sanitizado e reprocessamento.
- Mutações enviam `x-csrf-token`; reprocessamento envia `Idempotency-Key` aleatório por clique.
- Estados de carregamento, vazio e erro anunciados (`role="status"`/`role="alert"`), navegação por teclado.

### Ambiente

- Compose repassa `OPENAI_*`, `ASSISTANT_*` e `CONVERSATION_*` à API.
- `.env.example` do worker completo; script raiz `typecheck`; `README.md` na raiz.

## Fora de escopo

Gestão de usuários, adaptador de object storage, métricas e CI (Fases 9–10).
