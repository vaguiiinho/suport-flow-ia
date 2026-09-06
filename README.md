# SupportFlow AI

Central de suporte com assistente baseado em RAG, respostas citadas e escalonamento humano confirmado pelo cliente.

## Fundação atual

O monorepo contém:

- `apps/web`: Next.js App Router;
- `apps/api`: NestJS e Prisma;
- `apps/worker`: processo TypeScript com readiness do banco;
- `packages/shared`: contratos puros compartilhados;
- PostgreSQL com pgvector por Docker Compose.

## Início rápido

1. Copie os arquivos `.env.example` necessários e ajuste valores locais.
2. Suba o banco com `npm run db:up`.
3. Instale dependências com `npm install`.
4. Gere o Prisma Client com `npm run db:generate`.
5. Aplique a migration com `npm run db:migrate:dev`.
6. Crie a organização padrão com `npm run db:seed`.
7. Inicie os serviços com `npm run dev`.

Também é possível construir e iniciar todos os serviços com `docker compose up --build`.

## Documentação

- [Plano de ação](docs/plano-de-acao.md)
- [Checklist de implementação](docs/checklist-implementacao.md)
- [Ambiente e variáveis](docs/ambiente.md)
- [Decisões arquiteturais](docs/adr/README.md)
- [Instruções para agentes](AGENTS.md)
