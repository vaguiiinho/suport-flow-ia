# Docker Optimization

## Estado anterior

O projeto usa npm workspaces com `apps/web`, `apps/api`, `apps/worker` e `packages/shared`, Node 24 Alpine, PostgreSQL 16 com pgvector e quatro containers. O Web já usava Next.js standalone. API e worker copiavam o `node_modules` completo do monorepo para o runtime.

Baseline reconstruído antes das alterações (`docker images`): Web 288 MB, API 1,49 GB e Worker 1,01 GB.

## Problemas encontrados

- API e worker continham dependências de desenvolvimento e dependências dos outros workspaces. Impacto alto em disco, transferência e deploy; risco médio de correção por hoisting e links do workspace.
- O Web standalone ainda executava como root. Impacto de segurança; risco baixo.
- Não havia limites de CPU/RAM nem rotação do log `json-file`. Impacto em estabilidade e disco; risco baixo.
- A porta do worker era publicada no host sem consumidor externo. Impacto de segurança; risco baixo.
- Migration e seed são executados no startup. O seed é idempotente, cria a organização obrigatória e só cria o primeiro atendente quando as duas credenciais existem; por isso foi preservado.

## Alterações realizadas

- Instalações de produção filtradas para API+shared e Worker+shared.
- Prisma CLI explicitado como dependência de runtime da API, pois o startup executa `migrate deploy`.
- Prisma Client gerado no build e copiado sem levar o toolchain TypeScript/Nest/Jest/ESLint.
- `USER node` nos três runtimes e contexto Docker mais restrito.
- Worker deixou de publicar a porta 3002 no host; o healthcheck continua interno.
- Limites, heap Node e rotação de logs adicionados ao Compose.

## Dockerfiles

API e worker agora separam dependências, build, dependências de produção e runtime. O pacote `packages/shared/dist` é preservado. O Web mantém `.next/standalone` e `.next/static`. O histórico final tem 19 layers no Web, 24 na API e 21 no Worker.

## Docker Compose

São quatro serviços: Postgres, API, Worker contínuo e Web. `restart: unless-stopped` foi preservado. O Compose de desenvolvimento do banco permanece separado em `docker-compose.dev.yml`.

## CPU e memória

| Container | RAM observada em idle | Limite RAM | CPU limite | Heap Node |
| --- | ---: | ---: | ---: | ---: |
| Web | 41,7 MiB | 320 MiB | 0,50 | 224 MiB |
| API | 61,4 MiB | 320 MiB | 0,50 | 224 MiB |
| Worker | 50,8 MiB | 320 MiB | 0,50 | 224 MiB |
| Postgres | 31,6 MiB | 320 MiB | 0,50 | n/a |

Os limites são proteções contra runaway, não reservas.

## Next.js

O standalone existente foi preservado e validado. A imagem não carrega o `node_modules` do monorepo e executa como `node`.

## Node/NestJS

A API contém somente dependências de produção, `dist`, Prisma/migrations, seed, pacote shared compilado e healthcheck.

## Prisma

Quatro migrations foram reconhecidas sem pendências. A organização padrão foi confirmada pelo seed. O seed permanece idempotente no startup por ser bootstrap obrigatório do MVP.

## Workers

O worker é contínuo, possui endpoint de saúde e polling de ingestão; por isso mantém restart e healthcheck. A árvore de runtime foi filtrada para 20 pacotes instalados pelo npm (incluindo transitivos do recorte).

## Logs

Todos os serviços usam `json-file` com `max-size: 10m` e `max-file: 3`.

## Healthchecks

Web, API, worker e banco ficaram saudáveis. Os checks usam Node/fetch ou `pg_isready`; nenhuma ferramenta foi instalada apenas para healthcheck.

## Segurança

Web, API e worker executam como usuário `node`; uploads continuam graváveis via volume; worker não possui mais porta publicada. API e Web ainda são publicados em 3001/3000 porque o projeto não possui configuração de Nginx global versionada. Em produção, restringir essas portas a loopback ou à rede do proxy global.

## ARM64

Status: **PARCIAL**. Node 24 Alpine e pgvector publicam manifests arm64; Prisma, Sharp e PDF.js possuem suporte esperado. Falta executar build e smoke test nativos em Graviton, especialmente upload/PDF, Prisma e Sharp do standalone.

## Imagens

| Serviço | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Web | 288 MB | 288 MB | 0,0% |
| API | 1,49 GB | 830 MB | 44,3% |
| Worker | 1,01 GB | 325 MB | 67,8% |

Os valores são os tamanhos exibidos por `docker images` neste Docker Desktop. Em conteúdo OCI (`docker inspect .Size`), o resultado final foi 70,4 MB, 203,9 MB e 80,4 MB.

## Resultado do build

`docker compose config`, build, migrations, seed, startup, healthchecks, HTTP e logs foram validados. Nenhum container teve OOM ou restart na medição global.

## Pontos pendentes

- Validar carga de PDFs/embeddings e pico de memória com arquivos no limite.
- Executar build ARM64 nativo antes de adotar t4g.
- Integrar API/Web a um Nginx global e fechar as publicações diretas.
- Revisar dependências quando as fases restantes do MVP forem implementadas.
