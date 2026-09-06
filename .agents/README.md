# Agentes do SupportFlow AI

Este diretório organiza as instruções de projeto e os especialistas por responsabilidade.

## Arquivos de base

- [`operating-principles.md`](operating-principles.md): regras de trabalho e qualidade.
- [`project-architecture.md`](project-architecture.md): limites técnicos, dados e fluxos.
- [`agent-router.md`](agent-router.md): escolha e sequência de especialistas.

## Especialistas

- [`architect`](specialists/architect.md): escopo, arquitetura e ADRs.
- [`support-domain`](specialists/support-domain.md): conversas, conhecimento, tickets e regras.
- [`nestjs-backend`](specialists/nestjs-backend.md): API, casos de uso, Prisma e integrações.
- [`nextjs-frontend`](specialists/nextjs-frontend.md): chatbot, painel e acessibilidade.
- [`ai-rag`](specialists/ai-rag.md): retrieval, prompts, citações e avaliações.
- [`ingestion-worker`](specialists/ingestion-worker.md): PDF, chunking, embeddings e reprocessamento.
- [`security`](specialists/security.md): acesso, uploads, privacidade e prompt injection.
- [`qa`](specialists/qa.md): testes, E2E e avaliações de IA.
- [`reviewer`](specialists/reviewer.md): revisão crítica antes da entrega.
- [`documentation`](specialists/documentation.md): plano, checklist e ADRs.

## Skills locais

- [`answer-support-question`](skills/answer-support-question/SKILL.md)
- [`ingest-support-knowledge`](skills/ingest-support-knowledge/SKILL.md)
- [`triage-support-ticket`](skills/triage-support-ticket/SKILL.md)

Agentes definem responsabilidades de revisão e implementação. Skills definem fluxos repetíveis com entradas, limites e saídas específicas.
