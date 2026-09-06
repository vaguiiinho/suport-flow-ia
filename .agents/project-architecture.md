# Perfil de Arquitetura do Projeto

## Objetivo

Manter o SupportFlow AI simples de entender, seguro para demonstrar, preparado para trocar provedores e apto a evoluir de uma organização padrão para multi-tenant sem redefinir o domínio.

## Topologia

- `apps/web`: Next.js App Router, experiência pública e painel protegido.
- `apps/api`: NestJS, domínio, aplicação, apresentação e adaptadores.
- `apps/worker`: processo independente para ingestão e reindexação.
- `packages/shared`: contratos puros somente quando usados por mais de uma aplicação.

## Backend

Cada módulo deve separar:

```text
domain/          entidades, objetos de valor e portas
application/     casos de uso e DTOs internos
infrastructure/  Prisma, OpenAI, arquivos e implementações de portas
presentation/    controllers e DTOs HTTP
```

Módulos iniciais: `auth`, `conversations`, `knowledge`, `ingestion`, `assistant` e `tickets`.

## Portas obrigatórias

- `ChatModelPort`: recebe instruções, contexto autorizado e schema de saída; devolve resposta estruturada sem tipos do SDK.
- `EmbeddingProviderPort`: gera embeddings e expõe identidade/versionamento do modelo.
- `FileStoragePort`: grava, lê e remove objetos por identificador seguro.
- Repositórios por agregado, implementados por Prisma na infraestrutura.
- `OrganizationContext`: contexto resolvido no servidor e exigido por casos de uso e repositórios que acessam dados de negócio.

## Regras de dados

- `KnowledgeChunk` herda visibilidade e versão da fonte.
- `Organization` é criado desde a primeira migration; o MVP usa somente o registro padrão.
- Agregados de negócio carregam `organizationId`, e consultas nunca aceitam esse valor como autorização vinda diretamente do cliente.
- Restrições únicas, idempotência, vetores, jobs e caminhos de arquivo incluem o limite de organização.
- Uma versão só fica pesquisável após indexação integral bem-sucedida.
- Jobs usam claim concorrente, tentativas limitadas e idempotência.
- Ticket criado a partir de conversa usa chave de idempotência.
- Mensagens guardam referências usadas, não o prompt secreto nem credenciais.

## Fluxo RAG

```text
mensagem -> organização -> autorização -> retrieval público -> ranking -> suficiência
         -> resposta estruturada -> validação de citações -> persistência
         -> resposta ou fallback
```

Os filtros de organização e visibilidade ocorrem na consulta e são revalidados na seleção final. Citações devem apontar para fonte e trecho recuperados na mesma execução.

## Preparação para multi-tenant

- O MVP não possui seletor, onboarding, cobrança ou configuração por organização.
- A organização padrão é associada no servidor a atendentes, conversas anônimas, fontes, tickets e jobs.
- Interfaces de repositório exigem contexto de organização para leitura e escrita.
- Testes de integração usam duas organizações para provar isolamento.
- Uma futura ativação multi-tenant adiciona gestão e experiência de usuário, não uma nova fronteira de propriedade.

## Fronteira de autonomia

- O assistente pode responder, pedir esclarecimento e oferecer escalonamento.
- A triagem pode sugerir resumo, categoria e prioridade.
- Somente uma requisição confirmada pelo cliente cria ticket.
- Somente atendentes alteram status, prioridade definitiva ou responsável.

## Frontend

- Priorizar Server Components para conteúdo e telas sem interação local.
- Usar Client Components para chat, formulários, upload e interações do painel.
- Não duplicar regras de autorização ou domínio no cliente.
- Tornar citações, fallback, confirmação e erros compreensíveis e acessíveis.

## Testes por limite

- Domínio e casos de uso: unitários sem banco ou rede.
- Prisma, pgvector, armazenamento e controllers: integração realista.
- Chat, ingestão e ticket: E2E.
- Retrieval e resposta: dataset versionado e avaliações determinísticas quando possível.
- Adaptadores de IA: contract tests com respostas controladas; chamadas reais somente em suíte separada e opt-in.
