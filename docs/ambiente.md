# Ambiente de Desenvolvimento

## Requisitos

- Node.js 24 ou versão compatível com as dependências declaradas.
- npm 11.
- Docker com Docker Compose.

## Preparação local

```bash
npm install
npm run db:up
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run dev
```

O `docker-compose.dev.yml` sobe somente PostgreSQL com pgvector. Para executar a pilha completa em containers, use:

```bash
docker compose up --build
```

## Endpoints de saúde

- Web: `http://localhost:3000/api/health`
- API: `http://localhost:3001/api/v1/health`
- Worker: `http://localhost:3002/health`
- PostgreSQL: `pg_isready` dentro do container.

A API e o worker retornam indisponibilidade quando não conseguem consultar o banco.

## Variáveis da raiz e Docker Compose

| Variável                    | Finalidade                                            | Exemplo não secreto |
| --------------------------- | ----------------------------------------------------- | ------------------- |
| `POSTGRES_USER`             | Usuário local do PostgreSQL                           | `support_flow`      |
| `POSTGRES_PASSWORD`         | Senha local; deve ser trocada fora do desenvolvimento | `change-me`         |
| `POSTGRES_DB`               | Nome do banco                                         | `support_flow`      |
| `POSTGRES_PORT`             | Porta publicada do banco                              | `5432`              |
| `API_PORT`                  | Porta publicada da API                                | `3001`              |
| `WEB_PORT`                  | Porta publicada da web                                | `3000`              |
| `WORKER_PORT`               | Porta publicada do worker                             | `3002`              |
| `DEFAULT_ORGANIZATION_SLUG` | Slug estável da organização padrão                    | `support-flow`      |
| `DEFAULT_ORGANIZATION_NAME` | Nome exibível da organização padrão                   | `SupportFlow`       |
| `AUTH_SECURITY_PEPPER`      | Chave para pseudonimizar eventos de autenticação      | valor aleatório     |
| `COOKIE_SECURE`             | Exige HTTPS para cookies quando `true`                | `false` local       |
| `FILE_STORAGE_ROOT`         | Raiz persistente dos PDFs da base de conhecimento     | `./uploads`         |
| `PDF_MAX_BYTES`             | Tamanho máximo de cada PDF, em bytes                  | `10485760`          |
| `PDF_MAX_PAGES`             | Quantidade máxima de páginas de cada PDF              | `100`               |
| `ARTICLE_MAX_CHARACTERS`    | Tamanho máximo do conteúdo normalizado de um artigo   | `100000`            |

## Variáveis da API

| Variável                        | Obrigatória | Finalidade                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Sim         | Conexão PostgreSQL usada pelo Prisma.                                     |
| `PORT`                          | Não         | Porta interna; padrão `3001`.                                             |
| `WEB_ORIGIN`                    | Não         | Origens CORS separadas por vírgula; padrão local `http://localhost:3000`. |
| `DEFAULT_ORGANIZATION_SLUG`     | Não         | Identifica a organização criada pelo seed.                                |
| `DEFAULT_ORGANIZATION_NAME`     | Não         | Atualiza o nome da organização padrão no seed.                            |
| `AUTH_SECURITY_PEPPER`          | Sim         | HMAC de e-mail e rede nos eventos; mínimo de 32 caracteres.               |
| `AUTH_SESSION_TTL_SECONDS`      | Não         | Duração da sessão do atendente; padrão de 8 horas.                        |
| `ANONYMOUS_SESSION_TTL_SECONDS` | Não         | Duração da sessão anônima; padrão de 7 dias.                              |
| `AUTH_LOGIN_MAX_ATTEMPTS`       | Não         | Falhas permitidas por conta na janela; padrão `5`.                        |
| `AUTH_LOGIN_WINDOW_SECONDS`     | Não         | Janela persistente do rate limit; padrão de 15 minutos.                   |
| `COOKIE_SECURE`                 | Não         | Deve ser `true` em produção para cookies somente via HTTPS.               |
| `BOOTSTRAP_ATTENDANT_EMAIL`     | Não         | E-mail explícito para criar o primeiro atendente.                         |
| `BOOTSTRAP_ATTENDANT_PASSWORD`  | Não         | Senha explícita do bootstrap; mínimo de 12 caracteres.                    |
| `FILE_STORAGE_ROOT`             | Não         | Raiz do armazenamento local; padrão `./uploads`.                          |
| `PDF_MAX_BYTES`                 | Não         | Limite positivo em bytes por PDF; padrão `10485760` (10 MiB).             |
| `PDF_MAX_PAGES`                 | Não         | Limite positivo de páginas por PDF; padrão `100`.                         |
| `ARTICLE_MAX_CHARACTERS`        | Não         | Limite positivo do conteúdo após normalização; padrão `100000`.           |

As três variáveis numéricas de limite são validadas na inicialização e devem ser inteiros positivos. No Compose completo, `FILE_STORAGE_ROOT` é definido como `/app/uploads` e usa o volume nomeado `knowledge_files`; no processo local, caminhos relativos são resolvidos a partir do diretório de execução da API.

## Variáveis do worker

| Variável                             | Obrigatória             | Finalidade                                                        |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                       | Sim                     | Conexão usada pelo readiness e pela fila persistente.             |
| `WORKER_PORT`                        | Não                     | Porta interna de saúde; padrão `3002`.                            |
| `WORKER_ID`                          | Não                     | Identidade do worker usada no claim; padrão inclui o PID.         |
| `INGESTION_POLL_INTERVAL_MS`         | Não                     | Intervalo de polling sem jobs; padrão `2000`.                     |
| `INGESTION_CLAIM_TIMEOUT_MS`         | Não                     | Tempo para recuperar claim abandonado; padrão `120000`.           |
| `INGESTION_MAX_ATTEMPTS`             | Não                     | Máximo de tentativas por job; padrão `3`.                         |
| `INGESTION_RETRY_BASE_MS`            | Não                     | Base do backoff exponencial; padrão `5000`.                       |
| `INGESTION_EMBEDDING_BATCH_SIZE`     | Não                     | Máximo de chunks por chamada de embedding; padrão `32`.           |
| `INGESTION_CHUNK_MAX_CHARACTERS`     | Não                     | Tamanho máximo do fragmento; padrão `1200`.                       |
| `INGESTION_CHUNK_OVERLAP_CHARACTERS` | Não                     | Sobreposição entre fragmentos; padrão `200`.                      |
| `FILE_STORAGE_ROOT`                  | Sim para PDFs locais    | Mesmo diretório persistente usado pela API.                       |
| `OPENAI_API_KEY`                     | Sim para processar jobs | Segredo do adaptador de embeddings; nunca registrar ou versionar. |
| `OPENAI_BASE_URL`                    | Não                     | Base HTTPS da API; padrão `https://api.openai.com/v1`.            |
| `OPENAI_EMBEDDING_MODEL`             | Não                     | Modelo de embeddings; padrão `text-embedding-3-small`.            |
| `OPENAI_EMBEDDING_DIMENSIONS`        | Não                     | Dimensão esperada; padrão `1536`.                                 |
| `OPENAI_EMBEDDING_TIMEOUT_MS`        | Não                     | Timeout de uma chamada ao provedor; padrão `30000`.               |

## Variáveis da web

| Variável              | Obrigatória         | Finalidade               |
| --------------------- | ------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL` | Sim para integração | URL pública base da API. |

## Segurança

- Nunca versione `.env` real.
- Os valores dos `.env.example` são apenas modelos e não devem ser usados como credenciais de produção.
- Produção deve injetar segredos pelo ambiente de execução ou secret manager.
- O seed local é idempotente e não usa ID fixo para a organização padrão.
- As duas variáveis `BOOTSTRAP_ATTENDANT_*` devem ser fornecidas juntas e podem ser removidas após o primeiro seed.
- O valor padrão de `AUTH_SECURITY_PEPPER` no Compose é exclusivamente local; produção deve substituí-lo.
- `FILE_STORAGE_ROOT` deve apontar para um diretório dedicado e persistente, gravável pelo usuário da API; o conteúdo desse diretório não deve ser versionado.

Consulte [`autenticacao.md`](autenticacao.md) para os contratos HTTP e o fluxo de bootstrap.
Consulte [`conhecimento.md`](conhecimento.md) para o contrato administrativo da base de conhecimento e as regras de armazenamento.
