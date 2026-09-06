# ADR 0001 — Stack e topologia do monorepo

## Status

Aceito em 30 de agosto de 2026.

## Contexto

O SupportFlow AI precisa entregar uma interface pública, painel protegido, API de domínio, processamento assíncrono e busca vetorial. O projeto também deve ser simples de executar e explicar como peça de portfólio.

## Decisão

Adotar um monorepo TypeScript gerenciado por npm workspaces, composto por:

- `apps/web`: Next.js App Router e React;
- `apps/api`: NestJS com Clean Architecture e DDD;
- `apps/worker`: processo Node.js/TypeScript independente;
- `packages/shared`: contratos puros compartilhados somente quando necessários.

Usar PostgreSQL como banco principal, Prisma como ORM e pgvector para embeddings. O ambiente local será executado por Docker Compose. Cada aplicação terá lifecycle e `package.json` próprios, com scripts oficiais agregados na raiz.

O domínio e os casos de uso não dependerão de Next.js, NestJS, Prisma, pgvector ou SDKs externos. API e worker compartilharão contratos explícitos e persistência, não imports de runtime entre aplicações.

## Alternativas consideradas

- Monólito Next.js com rotas de API: menor scaffold, mas mistura apresentação, domínio e processamento assíncrono.
- Repositórios separados: maior isolamento, porém aumenta custo operacional antes de existir necessidade de deploy independente.
- Banco vetorial separado: adiciona serviço e sincronização sem benefício suficiente para o MVP.
- pnpm ou Yarn workspaces: válidos, mas diferentes do padrão npm adotado nos projetos mais recentes.

## Consequências

- Web, API e worker podem evoluir e ser implantados separadamente.
- PostgreSQL concentra dados transacionais, jobs e vetores no MVP.
- A separação de camadas exige disciplina e testes de contrato.
- `packages/shared` não deve virar atalho para acoplamento entre aplicações.
- Uma troca futura de ORM ou banco vetorial permanece localizada na infraestrutura.
