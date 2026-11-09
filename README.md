# SupportFlow AI

Central de suporte com assistente baseado em RAG: o cliente recebe respostas **citadas** a partir da base de
conhecimento aprovada (ou um fallback seguro) e só abre um ticket após **confirmação explícita**. Atendentes
gerenciam artigos, PDFs, indexação e tickets em uma área protegida.

## Arquitetura

| Pacote            | Stack                    | Responsabilidade                                                          | Porta |
| ----------------- | ------------------------ | ------------------------------------------------------------------------- | ----- |
| `apps/web`        | Next.js 16 (App Router)  | Chat do cliente (`/`) e painel do atendente (`/admin`)                    | 3000  |
| `apps/api`        | NestJS 11 + Prisma       | Autenticação, conhecimento, conversas, RAG e tickets (`/api/v1`)          | 3001  |
| `apps/worker`     | Node.js + TypeScript     | Fila persistente de ingestão: extração, chunking e embeddings no pgvector | 3002  |
| `packages/shared` | TypeScript               | Contratos puros compartilhados                                            | —     |
| PostgreSQL        | `pgvector/pgvector:pg16` | Dados relacionais e vetores                                               | 5432  |

A API segue camadas `domain` → `application` → `infrastructure` → `presentation` em cada módulo
(`apps/api/src/modules/*`). Os provedores de IA (OpenAI Responses e Embeddings) ficam atrás de portas, então o
sistema funciona sem chave: o chat responde com fallback e os jobs de ingestão falham de forma controlada.

## Pré-requisitos

- Node.js 24 e npm 11
- Docker com Docker Compose
- Opcional: uma chave da OpenAI (`OPENAI_API_KEY`) para respostas e indexação reais

## Opção 1 — Tudo em containers (mais rápido)

```bash
cp .env.example .env
# edite .env: defina AUTH_SECURITY_PEPPER (32+ caracteres aleatórios),
# BOOTSTRAP_ATTENDANT_EMAIL / BOOTSTRAP_ATTENDANT_PASSWORD (12+ caracteres)
# e, se quiser IA real, OPENAI_API_KEY=sk-...
docker compose up --build
```

A API aplica as migrations e executa o seed (organização padrão + primeiro atendente) ao iniciar.

- Chat do cliente: <http://localhost:3000>
- Painel do atendente: <http://localhost:3000/admin> (entre com o e-mail/senha do bootstrap)

Para gerar um pepper: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Opção 2 — Desenvolvimento local (hot reload)

```bash
# 1. Variáveis de ambiente
cp .env.example .env                       # usado pelo docker-compose.dev.yml (banco)
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env.local
```

Ajuste os arquivos copiados:

- `DATABASE_URL` em `apps/api/.env` e `apps/worker/.env` deve usar o mesmo usuário/senha/porta de
  `POSTGRES_*` no `.env` da raiz;
- `AUTH_SECURITY_PEPPER` (32+ caracteres) e `BOOTSTRAP_ATTENDANT_EMAIL`/`BOOTSTRAP_ATTENDANT_PASSWORD` em
  `apps/api/.env`;
- `OPENAI_API_KEY` em `apps/api/.env` **e** `apps/worker/.env` para IA real;
- o worker precisa ler os PDFs gravados pela API: mantenha `FILE_STORAGE_ROOT=./uploads` na API e
  `FILE_STORAGE_ROOT=../api/uploads` no worker (padrão dos exemplos).

```bash
# 2. Dependências, banco e dados iniciais
npm install
npm run db:up            # sobe PostgreSQL + pgvector
npm run db:generate      # gera o Prisma Client
npm run db:migrate:dev   # aplica as migrations
npm run db:seed          # organização padrão + primeiro atendente

# 3. Web, API e worker juntos
npm run dev
```

Para parar o banco: `npm run db:down`.

> Se o banco já foi inicializado antes com outra senha, o volume `postgres_dev_data` mantém a senha antiga.
> Use as credenciais originais ou recrie o volume com `docker compose -f docker-compose.dev.yml down -v`
> (isso **apaga** os dados locais).

## Como usar

1. Entre em `/admin` com o atendente do bootstrap.
2. Em **Base de conhecimento**, crie um artigo ou envie um PDF com visibilidade **Pública**. O worker indexa a
   fonte; o estado muda de "Na fila" para "Indexada". Falhas aparecem em **Falhas de ingestão** com botão
   **Reprocessar**.
3. Em `/`, faça uma pergunta. A resposta traz as fontes citadas; sem evidência suficiente, o assistente responde
   com fallback e oferece abrir um ticket.
4. O cliente confirma e informa um contato; o ticket aparece em **Tickets** no painel, com conversa, fontes
   citadas, histórico de mudanças e controles de estado, prioridade e categoria.

Fontes **Internas** nunca são usadas nas respostas ao cliente.

## Health checks

| Serviço | URL                                   |
| ------- | ------------------------------------- |
| Web     | <http://localhost:3000/api/health>    |
| API     | <http://localhost:3001/api/v1/health> |
| Worker  | <http://localhost:3002/health>        |

## Qualidade

```bash
npm run lint             # ESLint
npm run typecheck        # TypeScript em todos os workspaces
npm run format:check     # Prettier
npm test                 # testes unitários (api, web, worker, shared)
npm run build            # build de produção
npm run test:integration # requer DATABASE_URL apontando para um banco migrado
```

Os testes de integração criam e removem as próprias organizações, mas use um banco de desenvolvimento ou
descartável — nunca produção.

## Principais variáveis

Os arquivos `.env.example` (raiz e de cada app) listam todas as variáveis com valores padrão. As mais
importantes:

| Variável                                                     | Onde        | Observação                                         |
| ------------------------------------------------------------ | ----------- | -------------------------------------------------- |
| `DATABASE_URL`                                               | api, worker | Conexão PostgreSQL                                 |
| `AUTH_SECURITY_PEPPER`                                       | api         | Obrigatória, 32+ caracteres                        |
| `BOOTSTRAP_ATTENDANT_EMAIL` / `BOOTSTRAP_ATTENDANT_PASSWORD` | api (seed)  | Criam o primeiro atendente; podem sair após o seed |
| `OPENAI_API_KEY`                                             | api, worker | Sem ela: fallback no chat e falha na ingestão      |
| `FILE_STORAGE_ROOT`                                          | api, worker | Mesmo diretório nos dois processos                 |
| `WEB_ORIGIN`                                                 | api         | Origens confiáveis para CORS/CSRF                  |
| `NEXT_PUBLIC_API_URL`                                        | web         | URL base da API (`http://localhost:3001/api/v1`)   |
| `COOKIE_SECURE`                                              | api         | `true` em produção (HTTPS)                         |

Nunca versione arquivos `.env` reais.

## Documentação

- `docs/specs/` — especificações das entregas
- `docs/runs/` — registro das execuções (agentes, decisões e resultado dos testes)
- `CLAUDE.md` — princípios de arquitetura e fluxo de trabalho
